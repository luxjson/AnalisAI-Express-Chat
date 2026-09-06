const db = require("../db");

class ConfiguracaoNotificacao {
  static async findByUsuarioId(usuarioId) {
    const result = await db.query(
      "SELECT * FROM configuracoes_notificacoes WHERE usuario_id = $1",
      [usuarioId],
    );
    return result.rows[0];
  }

  static async findByAlunoId(alunoId) {
    const result = await db.query(
      "SELECT * FROM configuracoes_notificacoes WHERE aluno_id = $1",
      [alunoId],
    );
    return result.rows[0];
  }

  static async createOrUpdateForUsuario(usuarioId, config = {}) {
    return this._createOrUpdate("usuario_id", usuarioId, config);
  }

  static async createOrUpdateForAluno(alunoId, config = {}) {
    return this._createOrUpdate("aluno_id", alunoId, config);
  }

  static async _createOrUpdate(ownerColumn, ownerId, config = {}) {
    if (
      !["usuario_id", "aluno_id"].includes(ownerColumn) ||
      !Number.isInteger(Number(ownerId))
    ) {
      throw new TypeError("Proprietário de configuração inválido.");
    }
    const values = {
      notificacoes_ativas: config.notificacoes_ativas ?? true,
      notificacoes_email: config.notificacoes_email ?? false,
      notificacoes_tarefas: config.notificacoes_tarefas ?? true,
      notificacoes_avaliacoes: config.notificacoes_avaliacoes ?? true,
      notificacoes_competencias: config.notificacoes_competencias ?? true,
    };
    for (const value of Object.values(values)) {
      if (typeof value !== "boolean")
        throw new TypeError("Valores de notificação inválidos.");
    }

    await db.query(
      `INSERT INTO configuracoes_notificacoes (${ownerColumn}) VALUES ($1) ON CONFLICT DO NOTHING`,
      [ownerId],
    );
    const updated = await db.query(
      `UPDATE configuracoes_notificacoes
             SET notificacoes_ativas = $1, notificacoes_email = $2,
                 notificacoes_tarefas = $3, notificacoes_avaliacoes = $4,
                 notificacoes_competencias = $5
             WHERE ${ownerColumn} = $6
             RETURNING *`,
      [
        values.notificacoes_ativas,
        values.notificacoes_email,
        values.notificacoes_tarefas,
        values.notificacoes_avaliacoes,
        values.notificacoes_competencias,
        ownerId,
      ],
    );
    return updated.rows[0] || null;
  }
}

module.exports = ConfiguracaoNotificacao;
