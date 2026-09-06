const crypto = require("crypto");
const db = require("../db");
const { SYSTEM_TABLES } = require("./checkupService");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BACKUP_TABLES = [...SYSTEM_TABLES, "uploaded_files"];
let readyPromise;

function ensureTable() {
  if (!readyPromise) {
    readyPromise = db.ensureRuntimeSchema();
  }
  return readyPromise;
}

function serialize(value) {
  if (Buffer.isBuffer(value))
    return { __type: "Buffer", base64: value.toString("base64") };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serialize(v)]),
    );
  return value;
}

/**
 * Cria um snapshot (branch) no Neon via API.
 * Retorna os dados do branch criado.
 */
async function createNeonSnapshot() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error("NEON_API_KEY ou NEON_PROJECT_ID não configurados.");
  }

  const branchName = `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const response = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/branches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        branch: {
          name: branchName,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Neon API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
    );
  }

  const data = await response.json();
  return {
    branchId: data.branch.id,
    branchName: data.branch.name,
    createdAt: data.branch.created_at,
    connectionString: data.branch.connection_string || null,
  };
}

async function createBackup(origem = "automatico") {
  await ensureTable();
  const timestamp = new Date();
  const isoString = timestamp.toISOString();
  let backupType = "json";
  let snapshotInfo = null;
  let filename = `backup-analisai-${isoString.replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}.json`;
  let content = null;
  let sizeBytes = 0;
  let tableCount = 0;

  try {
    snapshotInfo = await createNeonSnapshot();
    backupType = "neon-snapshot";
    filename = `neon-snapshot-${snapshotInfo.branchName}.json`;
    content = JSON.stringify({ snapshot: snapshotInfo });
    sizeBytes = Buffer.byteLength(content, "utf8");
    tableCount = 1;
    console.log(
      `[Backup] Snapshot Neon criado: ${snapshotInfo.branchName} (${snapshotInfo.branchId})`,
    );
  } catch (err) {
    console.warn(
      "[Backup] Falha ao criar snapshot Neon, usando fallback JSON:",
      err.message,
    );
    const backupData = {
      metadata: {
        app: "AnalisAI",
        version: "1.0.4",
        createdAt: isoString,
        origem,
      },
      tables: {},
    };
    let count = 0;

    for (const table of BACKUP_TABLES) {
      if (!/^[a-z_][a-z0-9_]*$/i.test(table)) continue;
      try {
        const result = await db.query(`SELECT * FROM ${table}`);
        backupData.tables[table] = serialize(result.rows);
        count++;
      } catch (err) {
        console.warn(`[Backup] Falha ao exportar ${table}:`, err.message);
        backupData.tables[table] = [];
      }
    }

    content = JSON.stringify(backupData);
    sizeBytes = Buffer.byteLength(content, "utf8");
    tableCount = count;
    backupType = "json";
    filename = `backup-analisai-${isoString.replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}.json`;
  }
  const checksum = crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
  const backupOrigin = String(origem).slice(0, 100);
  const columnsInfo = await db.query(`
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_backups'
  `);
  const columnMap = new Map(
    columnsInfo.rows.map((row) => [row.column_name, row.udt_name]),
  );
  const insertColumns = [
    "filename",
    "created_at",
    "origem",
    "size_bytes",
    "table_count",
    "content",
  ];
  const values = [
    filename,
    timestamp,
    backupOrigin,
    sizeBytes,
    tableCount,
    content,
  ];
  if (columnMap.has("data")) {
    const dataType = columnMap.get("data");
    insertColumns.push("data");
    if (dataType === "jsonb") {
      values.push(JSON.stringify(isoString));
    } else if (dataType === "timestamptz" || dataType === "timestamp") {
      values.push(timestamp);
    } else {
      values.push(isoString);
    }
  }
  if (columnMap.has("reason")) {
    insertColumns.push("reason");
    values.push(backupOrigin);
  }
  if (columnMap.has("checksum")) {
    const checksumType = columnMap.get("checksum");
    insertColumns.push("checksum");
    if (checksumType === "bytea") {
      values.push(Buffer.from(checksum, "hex"));
    } else {
      values.push(checksum);
    }
  }

  if (columnMap.has("snapshot_id")) {
    insertColumns.push("snapshot_id");
    values.push(snapshotInfo?.branchId || null);
  }

  if (columnMap.has("tipo_backup")) {
    insertColumns.push("tipo_backup");
    values.push(backupType);
  }

  const placeholders = insertColumns
    .map((col, idx) => {
      const type = columnMap.get(col);
      if (type === "jsonb") return `$${idx + 1}::jsonb`;
      if (type === "bytea") return `$${idx + 1}::bytea`;
      return `$${idx + 1}`;
    })
    .join(", ");

  await db.query(
    `INSERT INTO system_backups (${insertColumns.join(", ")}) VALUES (${placeholders})`,
    values,
  );

  await db.query(
    `DELETE FROM system_backups WHERE id NOT IN (SELECT id FROM system_backups ORDER BY created_at DESC LIMIT 15)`,
  );

  return {
    filename,
    createdAt: isoString,
    origem: backupOrigin,
    sizeBytes,
    tableCount,
    tipo: backupType,
    snapshotId: snapshotInfo?.branchId || null,
    snapshotName: snapshotInfo?.branchName || null,
  };
}

async function getBackupStatus() {
  await ensureTable();
  const result = await db.query(`
    SELECT 
      filename, 
      created_at, 
      origem, 
      size_bytes, 
      table_count,
      tipo_backup,
      snapshot_id
    FROM system_backups 
    ORDER BY created_at DESC 
    LIMIT 15
  `);
  const backups = result.rows.map((row) => ({
    filename: row.filename,
    createdAt: row.created_at,
    origem: row.origem,
    sizeBytes: Number(row.size_bytes),
    tableCount: Number(row.table_count),
    tipo: row.tipo_backup || "json",
    snapshotId: row.snapshot_id || null,
  }));

  const last = backups[0]?.createdAt ? new Date(backups[0].createdAt) : null;
  const next = last ? new Date(last.getTime() + SEVEN_DAYS_MS) : null;
  const now = Date.now();

  return {
    lastBackup: last?.toISOString() || null,
    nextBackup: next?.toISOString() || null,
    intervalDays: 7,
    daysSinceLast: last
      ? Math.max(0, Math.floor((now - last.getTime()) / 86400000))
      : null,
    daysUntilNext: next
      ? Math.max(0, Math.ceil((next.getTime() - now) / 86400000))
      : null,
    totalBackups: backups.length,
    backups,
  };
}

async function getBackupFile(filename) {
  if (typeof filename !== "string" || filename.length > 180) return null;
  if (!/^(backup-analisai-|neon-snapshot-).+\.json$/.test(filename))
    return null;

  await ensureTable();
  const result = await db.query(
    "SELECT content FROM system_backups WHERE filename = $1 LIMIT 1",
    [filename],
  );
  if (!result.rows.length) return null;

  return Buffer.from(JSON.stringify(result.rows[0].content, null, 2), "utf8");
}

async function checkAndRunScheduledBackup() {
  const status = await getBackupStatus();
  if (
    !status.lastBackup ||
    Date.now() - new Date(status.lastBackup).getTime() >= SEVEN_DAYS_MS
  ) {
    return createBackup(status.lastBackup ? "agendado-7dias" : "inicial-7dias");
  }
  return null;
}

function init() {
  if (process.env.VERCEL) return;
  setTimeout(
    () =>
      checkAndRunScheduledBackup().catch((err) =>
        console.error("[Backup]", err.message),
      ),
    5000,
  );
  setInterval(
    () =>
      checkAndRunScheduledBackup().catch((err) =>
        console.error("[Backup]", err.message),
      ),
    6 * 60 * 60 * 1000,
  ).unref();
}

module.exports = {
  init,
  createBackup,
  getBackupStatus,
  getBackupFile,
  checkAndRunScheduledBackup,
  ensureTable,
};
