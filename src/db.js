require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DB_URL) {
    throw new Error('DB_URL deve ser configurado.');
}

const production = process.env.NODE_ENV === 'production';
const allowInsecureTls = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false';
if (production && allowInsecureTls) {
    throw new Error('DB_SSL_REJECT_UNAUTHORIZED=false não é permitido em produção.');
}

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: {
        rejectUnauthorized: !allowInsecureTls
    },
    max: Number(process.env.DB_POOL_MAX) > 0 ? Number(process.env.DB_POOL_MAX) : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    query_timeout: 30_000
});

pool.on('error', (err) => {
    console.error('Erro inesperado no pool PostgreSQL:', err.message);
});

module.exports = pool;
