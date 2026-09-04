const db = require('../db');

class ConfiguracaoNotificacao {
    static async findByUsuarioId(usuarioId) {
        const result = await db.query(
            'SELECT * FROM configuracoes_notificacoes WHERE usuario_id = $1',
            [usuarioId]
        );
        return result.rows[0];
    }

    static async findByAlunoId(alunoId) {
        const result = await db.query(
            'SELECT * FROM configuracoes_notificacoes WHERE aluno_id = $1',
            [alunoId]
        );
        return result.rows[0];
    }

    static async createOrUpdateForUsuario(usuarioId, config = {}) {
        return this._createOrUpdate('usuario_id', usuarioId, config);
    }

    static async createOrUpdateForAluno(alunoId, config = {}) {
        return this._createOrUpdate('aluno_id', alunoId, config);
    }

    static async _createOrUpdate(ownerColumn, ownerId, config = {}) {
        const values = {
            notificacoes_ativas: config.notificacoes_ativas ?? true,
            notificacoes_email: config.notificacoes_email ?? false,
            notificacoes_tarefas: config.notificacoes_tarefas ?? true,
            notificacoes_avaliacoes: config.notificacoes_avaliacoes ?? true,
            notificacoes_competencias: config.notificacoes_competencias ?? true
        };

        const updated = await db.query(
            `UPDATE configuracoes_notificacoes
             SET notificacoes_ativas = $1, notificacoes_email = $2,
                 notificacoes_tarefas = $3, notificacoes_avaliacoes = $4,
                 notificacoes_competencias = $5
             WHERE ${ownerColumn} = $6
             RETURNING *`,
            [values.notificacoes_ativas, values.notificacoes_email, values.notificacoes_tarefas, values.notificacoes_avaliacoes, values.notificacoes_competencias, ownerId]
        );
        if (updated.rows.length) return updated.rows[0];

        const inserted = await db.query(
            `INSERT INTO configuracoes_notificacoes
             (${ownerColumn}, notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [ownerId, values.notificacoes_ativas, values.notificacoes_email, values.notificacoes_tarefas, values.notificacoes_avaliacoes, values.notificacoes_competencias]
        );
        return inserted.rows[0];
    }
}

module.exports = ConfiguracaoNotificacao;
