const db = require('../db');

class Calendario {
    static async getEventos(mes, ano, turma = null) {
        let query = `
            SELECT * FROM calendario_eventos 
            WHERE (EXTRACT(MONTH FROM data_inicio) = $1 OR EXTRACT(MONTH FROM data_fim) = $1)
            AND EXTRACT(YEAR FROM data_inicio) = $2
        `;
        const params = [mes, ano];
        if (turma) {
            query += ` AND (turma = $3 OR turma IS NULL)`;
            params.push(turma);
        }
        query += ` ORDER BY data_inicio ASC`;
        const result = await db.query(query, params);
        return result.rows;
    }

    static async getFeriados(mes, ano) {
        const result = await db.query(`
            SELECT * FROM feriados 
            WHERE (EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2)
            OR (recorrente = true AND EXTRACT(MONTH FROM data) = $1)
            ORDER BY 
                CASE 
                    WHEN EXTRACT(YEAR FROM data) = $2 THEN 0 
                    ELSE 1 
                END,
                data ASC
        `, [mes, ano]);
        return result.rows;
    }

    static async getTiposEventos() {
        const result = await db.query(`
            SELECT 
                tipo,
                COUNT(*) as total,
                MIN(cor) as cor
            FROM calendario_eventos 
            GROUP BY tipo
            ORDER BY total DESC
        `);
        return result.rows;
    }

    static async criarEvento(titulo, descricao, tipo, data_inicio, data_fim, turma, cor, criado_por) {
        const result = await db.query(
            `INSERT INTO calendario_eventos (titulo, descricao, tipo, data_inicio, data_fim, turma, cor, criado_por) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [titulo, descricao, tipo || 'evento', data_inicio, data_fim || null, turma || null, cor || '#ff0101', criado_por]
        );
        return result.rows[0].id;
    }

    static async criarFeriado(nome, data, recorrente) {
        const result = await db.query(
            `INSERT INTO feriados (nome, data, recorrente) 
             VALUES ($1, $2, $3)
             ON CONFLICT (data, nome) DO NOTHING RETURNING id`,
            [nome, data, recorrente === true]
        );
        return result.rows[0] ? result.rows[0].id : null;
    }

    static async deletarEvento(id) {
        await db.query('DELETE FROM calendario_eventos WHERE id = $1', [id]);
        return true;
    }

    static async deletarFeriado(id) {
        await db.query('DELETE FROM feriados WHERE id = $1', [id]);
        return true;
    }

    static async getEventosProximos(limit = 10) {
        const result = await db.query(`
            SELECT * FROM calendario_eventos 
            WHERE data_inicio >= CURRENT_DATE 
            ORDER BY data_inicio ASC 
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    static async getFeriadosProximos(limit = 10) {
        const result = await db.query(`
            SELECT * FROM feriados 
            WHERE data >= CURRENT_DATE OR recorrente = true
            ORDER BY data ASC 
            LIMIT $1
        `, [limit]);
        return result.rows;
    }
}

module.exports = Calendario;