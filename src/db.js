require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DB_URL) throw new Error('DB_URL deve ser configurado.');

const production = process.env.NODE_ENV === 'production';
const allowInsecureTls = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false';
if (production && allowInsecureTls) throw new Error('DB_SSL_REJECT_UNAUTHORIZED=false não é permitido em produção.');

let connectionString = process.env.DB_URL;
if (process.env.DB_SSL_MODE !== 'disable') {
  try {
    const u = new URL(connectionString);
    const sslmode = u.searchParams.get('sslmode');
    if (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'verify-ca') {
      u.searchParams.set('sslmode', 'verify-full');
      connectionString = u.toString();
    }
  } catch (_) {
  }
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL_MODE === 'disable' ? false : { rejectUnauthorized: !allowInsecureTls },
  max: Number.isInteger(Number(process.env.DB_POOL_MAX)) && Number(process.env.DB_POOL_MAX) > 0 ? Math.min(Number(process.env.DB_POOL_MAX), 10) : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  query_timeout: 30_000,
  application_name: 'analisai'
});

pool.on('error', err => console.error('Erro inesperado no pool PostgreSQL:', err.message));

let runtimeSchemaPromise;
async function ensureRuntimeSchema() {
  if (runtimeSchemaPromise) return runtimeSchemaPromise;
  runtimeSchemaPromise = (async () => {
    const client = await pool.connect();
    const savepoint = async (sql, params = []) => {
      await client.query('SAVEPOINT runtime_schema_step');
      try {
        return await client.query(sql, params);
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT runtime_schema_step');
        console.warn('[Schema] Etapa ignorada:', err.message);
        return null;
      } finally {
        await client.query('RELEASE SAVEPOINT runtime_schema_step').catch(() => {});
      }
    };
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['analisai-runtime-schema-v4']);

      await client.query(`
        CREATE TABLE IF NOT EXISTS configuracoes_notificacoes (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
          notificacoes_ativas BOOLEAN NOT NULL DEFAULT TRUE,
          notificacoes_email BOOLEAN NOT NULL DEFAULT FALSE,
          notificacoes_tarefas BOOLEAN NOT NULL DEFAULT TRUE,
          notificacoes_avaliacoes BOOLEAN NOT NULL DEFAULT TRUE,
          notificacoes_competencias BOOLEAN NOT NULL DEFAULT TRUE,
          CHECK ((usuario_id IS NOT NULL AND aluno_id IS NULL) OR (usuario_id IS NULL AND aluno_id IS NOT NULL))
        )
      `);
      await savepoint(`DELETE FROM configuracoes_notificacoes a USING configuracoes_notificacoes b WHERE a.id < b.id AND a.usuario_id IS NOT NULL AND a.usuario_id = b.usuario_id`);
      await savepoint(`DELETE FROM configuracoes_notificacoes a USING configuracoes_notificacoes b WHERE a.id < b.id AND a.aluno_id IS NOT NULL AND a.aluno_id = b.aluno_id`);
      await savepoint('CREATE UNIQUE INDEX IF NOT EXISTS uq_config_notif_usuario ON configuracoes_notificacoes(usuario_id) WHERE usuario_id IS NOT NULL');
      await savepoint('CREATE UNIQUE INDEX IF NOT EXISTS uq_config_notif_aluno ON configuracoes_notificacoes(aluno_id) WHERE aluno_id IS NOT NULL');

      await client.query(`
        CREATE TABLE IF NOT EXISTS security_rate_limits (
          rate_key TEXT PRIMARY KEY,
          window_start TIMESTAMPTZ NOT NULL,
          request_count INTEGER NOT NULL CHECK (request_count >= 0)
        )
      `);
      await savepoint(`DELETE FROM security_rate_limits WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '48 hours'`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
          storage_key TEXT PRIMARY KEY,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 10485760),
          content BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await savepoint('CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at ON uploaded_files(created_at DESC)');

      await client.query('CREATE TABLE IF NOT EXISTS system_backups (id BIGSERIAL PRIMARY KEY)');
      const columnsResult = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='system_backups'
        ORDER BY ordinal_position
      `);
      const columns = new Map(columnsResult.rows.map(r => [r.column_name, r]));

      const addColumn = async (name, definition) => {
        if (!columns.has(name)) {
          const result = await savepoint(`ALTER TABLE system_backups ADD COLUMN ${name} ${definition}`);
          if (result) columns.set(name, { column_name: name });
        }
      };

      await addColumn('filename', 'TEXT');
      await addColumn('created_at', 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
      await addColumn('origem', "TEXT NOT NULL DEFAULT 'migracao'");
      await addColumn('size_bytes', 'INTEGER NOT NULL DEFAULT 0');
      await addColumn('table_count', 'INTEGER NOT NULL DEFAULT 0');
      await addColumn('content', "JSONB NOT NULL DEFAULT '{}'::jsonb");
      if (columns.has('reason')) {
        await savepoint("UPDATE system_backups SET reason = COALESCE(NULLIF(reason, ''), 'migracao') WHERE reason IS NULL OR reason = ''");
        await savepoint("ALTER TABLE system_backups ALTER COLUMN reason SET DEFAULT 'migracao'");
      }

      if (columns.has('filename')) {
        await savepoint("UPDATE system_backups SET filename = 'backup-analisai-migrado-' || id || '.json' WHERE filename IS NULL OR filename = ''");
      }
      if (columns.has('size_bytes') && columns.has('content')) {
        await savepoint("UPDATE system_backups SET size_bytes = octet_length(content::text) WHERE (size_bytes IS NULL OR size_bytes = 0) AND content IS NOT NULL");
      }
      const checksumColumn = columns.get('checksum');
      if (checksumColumn) {
        const checksumExpr = ['text', 'character varying', 'character'].includes(checksumColumn.data_type)
          ? "''"
          : checksumColumn.udt_name === 'bytea'
            ? "decode('', 'hex')"
            : null;
        if (checksumExpr && columns.has('content')) {
          await savepoint(`UPDATE system_backups SET checksum = ${checksumExpr} WHERE checksum IS NULL AND content IS NOT NULL`);
        }
      }

      const finalColumns = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='system_backups'
      `);
      const finalNames = new Set(finalColumns.rows.map(r => r.column_name));
      const finalChecksum = finalColumns.rows.find(r => r.column_name === 'checksum');

      if (finalNames.has('filename')) {
        await savepoint(`WITH duplicates AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY filename ORDER BY id) AS rn
          FROM system_backups WHERE filename IS NOT NULL
        ) UPDATE system_backups b SET filename = b.filename || '-migrado-' || b.id
        WHERE b.id IN (SELECT id FROM duplicates WHERE rn > 1)`);
        await savepoint('ALTER TABLE system_backups ALTER COLUMN filename SET NOT NULL');
        await savepoint('CREATE UNIQUE INDEX IF NOT EXISTS uq_system_backups_filename ON system_backups(filename)');
      }
      await savepoint('CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON system_backups(created_at DESC)');

      if (finalChecksum && finalChecksum.is_nullable === 'NO') {
        const remaining = await client.query('SELECT COUNT(*)::int AS count FROM system_backups WHERE checksum IS NULL');
        if (remaining.rows[0].count > 0) {
          console.warn(`[Schema] system_backups.checksum ainda possui ${remaining.rows[0].count} registro(s) nulo(s); backups novos continuam fornecendo checksum.`);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      runtimeSchemaPromise = null;
      throw err;
    } finally {
      client.release();
    }
  })();
  return runtimeSchemaPromise;
}

module.exports = pool;
module.exports.ensureRuntimeSchema = ensureRuntimeSchema;
