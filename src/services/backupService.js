const fs = require('fs');
const path = require('path');
const db = require('../db');
const { SYSTEM_TABLES } = require('./checkupService');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const METADATA_FILE = path.join(BACKUP_DIR, 'metadata.json');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function ensureBackupDirectory() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

function loadMetadata() {
    ensureBackupDirectory();
    if (!fs.existsSync(METADATA_FILE)) {
        return {
            lastBackup: null,
            nextBackup: null,
            intervalDays: 7,
            backups: []
        };
    }
    try {
        const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Erro ao ler metadata de backup:', err);
        return {
            lastBackup: null,
            nextBackup: null,
            intervalDays: 7,
            backups: []
        };
    }
}

function saveMetadata(meta) {
    ensureBackupDirectory();
    fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * Cria snapshot do banco de dados (todas as tabelas do sistema)
 */
async function createBackup(origem = 'automatico') {
    ensureBackupDirectory();
    const timestamp = new Date();
    const isoString = timestamp.toISOString();
    const fileTimestamp = isoString.replace(/[:.]/g, '-');
    const filename = `backup-analisai-${fileTimestamp}.json`;
    const targetPath = path.join(BACKUP_DIR, filename);

    const backupData = {
        metadata: {
            app: 'AnalisAI',
            version: '1.0.4',
            createdAt: isoString,
            origem: origem
        },
        tables: {}
    };

    let tableCount = 0;
    for (const table of SYSTEM_TABLES) {
        try {
            const res = await db.query(`SELECT * FROM ${table}`);
            backupData.tables[table] = res.rows;
            tableCount++;
        } catch (err) {
            console.warn(`Aviso ao exportar tabela ${table} para backup:`, err.message);
            backupData.tables[table] = [];
        }
    }

    const jsonContent = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(targetPath, jsonContent, 'utf-8');
    const stats = fs.statSync(targetPath);

    const meta = loadMetadata();
    meta.lastBackup = isoString;
    meta.nextBackup = new Date(timestamp.getTime() + SEVEN_DAYS_MS).toISOString();
    meta.backups.unshift({
        filename,
        createdAt: isoString,
        origem,
        sizeBytes: stats.size,
        tableCount
    });

    // Manter no máximo os últimos 15 backups para economizar disco
    if (meta.backups.length > 15) {
        const toRemove = meta.backups.splice(15);
        for (const item of toRemove) {
            const oldPath = path.join(BACKUP_DIR, item.filename);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (_) {}
            }
        }
    }

    saveMetadata(meta);

    console.log(`[Backup] Snapshot '${filename}' criado com sucesso (${origem}). Próximo agendado para 7 dias.`);
    return {
        filename,
        createdAt: isoString,
        origem,
        sizeBytes: stats.size,
        tableCount
    };
}

/**
 * Obtém o status do backup semanal
 */
function getBackupStatus() {
    const meta = loadMetadata();
    const now = Date.now();
    let daysSinceLast = null;
    let daysUntilNext = null;

    if (meta.lastBackup) {
        const lastTime = new Date(meta.lastBackup).getTime();
        daysSinceLast = Math.max(0, Math.floor((now - lastTime) / (24 * 60 * 60 * 1000)));
        const nextTime = new Date(meta.nextBackup || (lastTime + SEVEN_DAYS_MS)).getTime();
        daysUntilNext = Math.max(0, Math.ceil((nextTime - now) / (24 * 60 * 60 * 1000)));
    }

    return {
        lastBackup: meta.lastBackup,
        nextBackup: meta.nextBackup,
        intervalDays: 7,
        daysSinceLast,
        daysUntilNext,
        totalBackups: meta.backups.length,
        backups: meta.backups
    };
}

/**
 * Retorna o caminho de arquivo para download com validação de segurança
 */
function getBackupFilePath(filename) {
    if (!filename || typeof filename !== 'string') return null;
    const safeName = path.basename(filename);
    if (safeName !== filename || !safeName.startsWith('backup-analisai-') || !safeName.endsWith('.json')) {
        return null;
    }
    const fullPath = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(fullPath)) return null;
    return fullPath;
}

/**
 * Verifica se o intervalo de 7 dias expirou e dispara backup se necessário
 */
async function checkAndRunScheduledBackup() {
    try {
        const meta = loadMetadata();
        const now = Date.now();

        if (!meta.lastBackup) {
            console.log('[Backup] Nenhum backup prévio detectado. Executando snapshot inicial de 7 dias...');
            await createBackup('inicial-7dias');
            return;
        }

        const lastTime = new Date(meta.lastBackup).getTime();
        if (now - lastTime >= SEVEN_DAYS_MS) {
            console.log('[Backup] Ciclo de 7 dias atingido. Executando backup semanal automático...');
            await createBackup('agendado-7dias');
        }
    } catch (err) {
        console.error('[Backup] Erro na verificação agendada de backup:', err.message);
    }
}

/**
 * Inicializador da rotina de backup semanal
 */
function init() {
    ensureBackupDirectory();
    // Executa verificação inicial após 5 segundos da subida do servidor
    setTimeout(() => {
        checkAndRunScheduledBackup();
    }, 5000);

    // Verifica a cada 6 horas se o prazo de 7 dias foi atingido
    setInterval(checkAndRunScheduledBackup, 6 * 60 * 60 * 1000).unref();
}

module.exports = {
    init,
    createBackup,
    getBackupStatus,
    getBackupFilePath
};
