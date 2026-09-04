const db = require('../db');

class SolicitacaoSenha {
    static async create(usuarioId, email, token, status = 'PENDENTE') {
        const result = await db.query(
            `INSERT INTO solicitacoes_senha (usuario_id, email, token, status) 
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [usuarioId, email, token, status]
        );
        return result.rows[0].id;
    }

    static async findPendentes() {
        const result = await db.query(`
            SELECT 
                s.*,
                u.nome
            FROM solicitacoes_senha s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.status = 'PENDENTE'
            ORDER BY s.data_solicitacao DESC
        `);
        return result.rows;
    }

    static async findById(id) {
        const result = await db.query('SELECT * FROM solicitacoes_senha WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async aprovar(id, respondidoPor) {
        await db.query(
            `UPDATE solicitacoes_senha 
             SET status = 'APROVADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 
             WHERE id = $2`,
            [respondidoPor, id]
        );
    }

    static async rejeitar(id, respondidoPor, motivo = null) {
        await db.query(
            `UPDATE solicitacoes_senha 
             SET status = 'REJEITADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 
             WHERE id = $2`,
            [respondidoPor, id]
        );
    }
}

module.exports = SolicitacaoSenha;