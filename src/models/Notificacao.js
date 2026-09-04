const db = require('../db');

class Notificacao {
    static async criar(tipo, usuarioId, alunoId, titulo, mensagem, link, icone = 'fas fa-bell', cor = '#ff0101') {
        try {
            const result = await db.query(
                `INSERT INTO notificacoes (usuario_id, aluno_id, tipo, titulo, mensagem, link, icone, cor) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [usuarioId || null, alunoId || null, tipo, titulo, mensagem, link, icone, cor]
            );
            return result.rows[0].id;
        } catch (err) {
            console.error('Erro ao criar notificação:', err);
            return null;
        }
    }

    static async getNaoLidas(usuarioId = null, alunoId = null) {
        let query = '';
        let params = [];
        if (alunoId) {
            query = `SELECT * FROM notificacoes WHERE aluno_id = $1 AND lida = false ORDER BY data_criacao DESC LIMIT 20`;
            params = [alunoId];
        } else if (usuarioId) {
            query = `SELECT * FROM notificacoes WHERE usuario_id = $1 AND lida = false ORDER BY data_criacao DESC LIMIT 20`;
            params = [usuarioId];
        } else {
            return [];
        }
        const result = await db.query(query, params);
        return result.rows;
    }

    static async countNaoLidas(usuarioId = null, alunoId = null) {
        let query = '';
        let params = [];
        if (alunoId) {
            query = `SELECT COUNT(*) as total FROM notificacoes WHERE aluno_id = $1 AND lida = false`;
            params = [alunoId];
        } else if (usuarioId) {
            query = `SELECT COUNT(*) as total FROM notificacoes WHERE usuario_id = $1 AND lida = false`;
            params = [usuarioId];
        } else {
            return 0;
        }
        const result = await db.query(query, params);
        return parseInt(result.rows[0].total);
    }

    static async marcarLida(id, usuarioId = null, alunoId = null) {
        let query = '';
        let params = [];
        if (alunoId) {
            query = `UPDATE notificacoes SET lida = true WHERE id = $1 AND aluno_id = $2 RETURNING id`;
            params = [id, alunoId];
        } else if (usuarioId) {
            query = `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2 RETURNING id`;
            params = [id, usuarioId];
        } else {
            return false;
        }
        const result = await db.query(query, params);
        return result.rows.length > 0;
    }

    static async marcarTodasLidas(usuarioId = null, alunoId = null) {
        let query = '';
        let params = [];
        if (alunoId) {
            query = `UPDATE notificacoes SET lida = true WHERE aluno_id = $1 AND lida = false`;
            params = [alunoId];
        } else if (usuarioId) {
            query = `UPDATE notificacoes SET lida = true WHERE usuario_id = $1 AND lida = false`;
            params = [usuarioId];
        } else {
            return false;
        }
        await db.query(query, params);
        return true;
    }
}

module.exports = Notificacao;