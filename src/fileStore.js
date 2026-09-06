const db = require('./db');

let readyPromise;
function ensureTable() {
  if (!readyPromise) {
    readyPromise = db.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        storage_key TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
        content BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => db.query('CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at ON uploaded_files(created_at)'));
  }
  return readyPromise;
}

async function save({ storageKey, originalName, mimeType, buffer }) {
  await ensureTable();
  await db.query(
    `INSERT INTO uploaded_files (storage_key, original_name, mime_type, size_bytes, content)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (storage_key) DO UPDATE SET
       original_name = EXCLUDED.original_name,
       mime_type = EXCLUDED.mime_type,
       size_bytes = EXCLUDED.size_bytes,
       content = EXCLUDED.content`,
    [storageKey, originalName, mimeType, buffer.length, buffer]
  );
}

async function get(storageKey) {
  await ensureTable();
  const result = await db.query(
    'SELECT original_name, mime_type, size_bytes, content FROM uploaded_files WHERE storage_key = $1 LIMIT 1',
    [storageKey]
  );
  return result.rows[0] || null;
}

async function remove(storageKey) {
  if (!storageKey) return;
  await ensureTable();
  await db.query('DELETE FROM uploaded_files WHERE storage_key = $1', [storageKey]);
}

module.exports = { save, get, remove, ensureTable };
