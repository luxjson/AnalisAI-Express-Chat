const db = require("../db");
const { criarNotificacao } = require("../utils/notificacao");
const {
  integerId,
  text,
  booleanValue,
  ALLOWED_YEARS,
} = require("../utils/validation");

exports.getConta = async (req, res) => {
  try {
    const formatDateTime = (value) =>
      value
        ? new Date(value).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "—";
    const formatDate = (value) =>
      value
        ? new Date(value).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })
        : "—";

    if (req.session.aluno?.id) {
      const result = await db.query(
        `
                SELECT a.nome, a.ano_escolar, a.idade, a.presenca,
                       al.email, al.matricula, al.status, al.data_criacao, al.ultimo_acesso,
                       (SELECT COUNT(*) FROM aluno_competencias ac WHERE ac.aluno_id = a.id) AS avaliacoes
                FROM alunos a
                JOIN alunos_login al ON al.aluno_id = a.id
                WHERE a.id = $1 LIMIT 1`,
        [req.session.aluno.id],
      );
      if (!result.rows.length)
        return res.status(404).json({ error: "Aluno não encontrado" });
      const row = result.rows[0];
      return res.json({
        initial: row.nome?.charAt(0).toUpperCase() || "A",
        name: row.nome,
        class: row.ano_escolar,
        registration: row.matricula || "—",
        email: row.email || "Não informado",
        age: row.idade ? `${row.idade} anos` : "—",
        assessments: Number(row.avaliacoes || 0),
        attendance: `${Number(row.presenca || 0)}%`,
        status: row.status || "ATIVO",
        created: formatDate(row.data_criacao),
        lastAccess: formatDateTime(row.ultimo_acesso),
      });
    }

    if (req.session.userId) {
      const result = await db.query(
        `SELECT nome, email, cargo, data_criacao, ultimo_acesso FROM usuarios WHERE id = $1 LIMIT 1`,
        [req.session.userId],
      );
      if (!result.rows.length)
        return res.status(404).json({ error: "Usuário não encontrado" });
      const row = result.rows[0];
      let tasks = 0;
      let students = 0;
      try {
        const stats = await db.query(
          `SELECT
                    (SELECT COUNT(*) FROM tarefas WHERE criado_por = $1) AS tarefas,
                    (SELECT COUNT(DISTINCT ta.aluno_id)
                       FROM tarefas_alunos ta
                       INNER JOIN tarefas t ON t.id = ta.tarefa_id
                      WHERE t.criado_por = $1) AS alunos`,
          [req.session.userId],
        );
        tasks = Number(stats.rows[0]?.tarefas || 0);
        students = Number(stats.rows[0]?.alunos || 0);
      } catch (statsError) {
        console.error(
          "Erro ao buscar estatísticas da conta:",
          statsError.message,
        );
        try {
          const taskCount = await db.query(
            "SELECT COUNT(*) AS total FROM tarefas WHERE criado_por = $1",
            [req.session.userId],
          );
          tasks = Number(taskCount.rows[0]?.total || 0);
        } catch (_) {}
      }
      return res.json({
        initial: row.nome?.charAt(0).toUpperCase() || "P",
        name: row.nome,
        email: row.email || "Não informado",
        role: row.cargo || req.session.userCargo || "Professor",
        created: formatDate(row.data_criacao),
        lastAccess: formatDateTime(row.ultimo_acesso),
        tasks,
        students,
      });
    }
    return res.status(401).json({ error: "Não autorizado" });
  } catch (err) {
    console.error("Erro ao buscar dados da conta:", err);
    return res.status(500).json({ error: "Erro ao buscar dados da conta" });
  }
};

exports.getNotificacoes = async (req, res) => {
  try {
    let query = "";
    let params = [];
    if (req.session.aluno) {
      query = `SELECT * FROM notificacoes WHERE aluno_id = $1 AND lida = false ORDER BY data_criacao DESC LIMIT 20`;
      params = [req.session.aluno.id];
    } else if (req.session.user) {
      query = `SELECT * FROM notificacoes WHERE usuario_id = $1 AND lida = false ORDER BY data_criacao DESC LIMIT 20`;
      params = [req.session.userId];
    } else {
      return res.json({ notificacoes: [], totalNaoLidas: 0 });
    }
    const result = await db.query(query, params);
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM notificacoes WHERE ${req.session.aluno ? "aluno_id" : "usuario_id"} = $1 AND lida = false`,
      [req.session.aluno ? req.session.aluno.id : req.session.userId],
    );
    res.json({
      notificacoes: result.rows,
      totalNaoLidas: parseInt(countResult.rows[0].total),
    });
  } catch (err) {
    console.error("Erro ao buscar notificações:", err);
    res.status(500).json({ error: "Erro ao buscar notificações" });
  }
};

exports.marcarNotificacaoLida = async (req, res) => {
  try {
    const id = integerId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    let query = "";
    let params = [];
    if (req.session.aluno) {
      query = `UPDATE notificacoes SET lida = true WHERE id = $1 AND aluno_id = $2 RETURNING id`;
      params = [id, req.session.aluno.id];
    } else if (req.session.user) {
      query = `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2 RETURNING id`;
      params = [id, req.session.userId];
    } else {
      return res.status(401).json({ error: "Não autorizado" });
    }
    const result = await db.query(query, params);
    if (result.rows.length > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Notificação não encontrada" });
    }
  } catch (err) {
    console.error("Erro ao marcar notificação como lida:", err);
    res.status(500).json({ error: "Erro ao processar" });
  }
};

exports.marcarTodasNotificacoesLidas = async (req, res) => {
  try {
    let query = "";
    let params = [];
    if (req.session.aluno) {
      query = `UPDATE notificacoes SET lida = true WHERE aluno_id = $1 AND lida = false`;
      params = [req.session.aluno.id];
    } else if (req.session.user) {
      query = `UPDATE notificacoes SET lida = true WHERE usuario_id = $1 AND lida = false`;
      params = [req.session.userId];
    } else {
      return res.status(401).json({ error: "Não autorizado" });
    }
    await db.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao marcar todas como lidas:", err);
    res.status(500).json({ error: "Erro ao processar" });
  }
};

exports.getConfiguracoesNotificacoes = async (req, res) => {
  try {
    const ownerColumn = req.session.aluno?.id
      ? "aluno_id"
      : req.session.userId
        ? "usuario_id"
        : null;
    const ownerId = req.session.aluno?.id || req.session.userId;
    if (!ownerColumn || !ownerId)
      return res.status(401).json({ error: "Não autorizado" });

    let result = await db.query(
      `SELECT * FROM configuracoes_notificacoes WHERE ${ownerColumn} = $1 LIMIT 1`,
      [ownerId],
    );
    if (!result.rows.length) {
      result = await db.query(
        `INSERT INTO configuracoes_notificacoes (${ownerColumn}) VALUES ($1) RETURNING *`,
        [ownerId],
      );
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar configurações de notificações:", err.message);
    return res
      .status(500)
      .json({ error: "Erro ao buscar configurações de notificações" });
  }
};

exports.saveConfiguracoesNotificacoes = async (req, res) => {
  try {
    const ownerColumn = req.session.aluno?.id
      ? "aluno_id"
      : req.session.userId
        ? "usuario_id"
        : null;
    const ownerId = req.session.aluno?.id || req.session.userId;
    if (!ownerColumn || !ownerId)
      return res.status(401).json({ error: "Não autorizado" });

    const keys = [
      "notificacoes_ativas",
      "notificacoes_email",
      "notificacoes_tarefas",
      "notificacoes_avaliacoes",
      "notificacoes_competencias",
    ];
    const updates = [];
    const params = [ownerId];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, key)) continue;
      const value = booleanValue(req.body[key]);
      if (value === null)
        return res
          .status(400)
          .json({ error: "Configuração de notificações inválida." });
      params.push(value);
      updates.push(`${key} = $${params.length}`);
    }
    if (!updates.length)
      return res
        .status(400)
        .json({ error: "Nenhuma configuração válida foi enviada." });

    await db.query(
      `INSERT INTO configuracoes_notificacoes (${ownerColumn}) VALUES ($1) ON CONFLICT DO NOTHING`,
      [ownerId],
    );
    const result = await db.query(
      `UPDATE configuracoes_notificacoes SET ${updates.join(", ")} WHERE ${ownerColumn} = $1 RETURNING *`,
      params,
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Configuração não encontrada." });
    return res.json({ success: true, config: result.rows[0] });
  } catch (err) {
    console.error("Erro ao salvar configurações de notificações:", err.message);
    return res
      .status(500)
      .json({ error: "Erro ao salvar configurações de notificações" });
  }
};

exports.tarefasStats = async (req, res) => {
  try {
    const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'ATIVA' THEN 1 END) as ativas,
                COUNT(CASE WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN 1 END) as atrasadas,
                COUNT(CASE WHEN prioridade = 'ALTA' AND status = 'ATIVA' THEN 1 END) as prioridade_alta
            FROM tarefas
        `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
};

exports.alunoDadosGrafico = async (req, res) => {
  try {
    if (!req.session.aluno) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    const alunoId = req.session.aluno.id;
    const result = await db.query(
      `
            SELECT 
                c.nome,
                ac.nota,
                c.categoria
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY c.categoria, ac.nota DESC
        `,
      [alunoId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar dados do gráfico:", err);
    res.status(500).json({ error: "Erro ao carregar dados" });
  }
};

exports.alunoRankingComparativo = async (req, res) => {
  try {
    if (!req.session.aluno) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    const alunoId = req.session.aluno.id;
    const aluno = req.session.aluno;
    const alunoMedia = await db.query(
      `
            SELECT COALESCE(AVG(nota), 0) as media
            FROM aluno_competencias
            WHERE aluno_id = $1
        `,
      [alunoId],
    );
    const turmaMedia = await db.query(
      `
            SELECT COALESCE(AVG(ac.nota), 0) as media
            FROM aluno_competencias ac
            JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar = $1
        `,
      [aluno.ano_escolar],
    );
    const geralMedia = await db.query(`
            SELECT COALESCE(AVG(nota), 0) as media
            FROM aluno_competencias
        `);
    res.json({
      aluno: parseFloat(alunoMedia.rows[0].media).toFixed(1),
      turma: parseFloat(turmaMedia.rows[0].media).toFixed(1),
      geral: parseFloat(geralMedia.rows[0].media).toFixed(1),
    });
  } catch (err) {
    console.error("Erro ao buscar ranking comparativo:", err);
    res.status(500).json({ error: "Erro ao carregar dados" });
  }
};
exports.buscarAlunos = async (req, res) => {
  try {
    const busca = text(req.query.busca, 100) || "";
    const turma = ALLOWED_YEARS.includes(req.query.turma)
      ? req.query.turma
      : "";
    let query = `
            SELECT a.id, a.nome, a.ano_escolar, a.nota, a.presenca, a.nivel, al.email, al.matricula
            FROM alunos a
            LEFT JOIN alunos_login al ON a.id = al.aluno_id
            WHERE 1=1
        `;
    const params = [];

    if (busca && busca.trim() !== "") {
      params.push(`%${busca.trim().toLowerCase()}%`);
      query += ` AND (LOWER(a.nome) LIKE $${params.length} OR LOWER(al.email) LIKE $${params.length} OR LOWER(al.matricula) LIKE $${params.length})`;
    }

    if (turma && turma.trim() !== "") {
      params.push(turma.trim());
      query += ` AND a.ano_escolar = $${params.length}`;
    }

    query += ` ORDER BY a.nome ASC LIMIT 50`;

    const result = await db.query(query, params);
    res.json({ sucesso: true, total: result.rows.length, alunos: result.rows });
  } catch (err) {
    console.error("Erro ao buscar alunos:", err);
    res
      .status(500)
      .json({ sucesso: false, error: "Erro interno ao realizar busca" });
  }
};

exports.healthCheck = async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.status(200).json({
      status: "UP",
      timestamp: new Date().toISOString(),
      database: "CONNECTED",
    });
  } catch (err) {
    console.error("Erro na verificação do Health Check:", err);
    res.status(500).json({
      status: "DOWN",
      timestamp: new Date().toISOString(),
      database: "DISCONNECTED",
    });
  }
};
