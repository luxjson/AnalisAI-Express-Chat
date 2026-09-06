const db = require("../db");
const { criarNotificacao } = require("../utils/notificacao");
const {
  text,
  integerId,
  numberInRange,
  dateOnly,
  ALLOWED_PRIORITY,
  ALLOWED_TASK_STATUS,
  ALLOWED_YEARS,
} = require("../utils/validation");

exports.listar = async (req, res) => {
  try {
    const turmaFilter = ALLOWED_YEARS.includes(req.query.turma)
      ? req.query.turma
      : "";
    const statusFilter = ALLOWED_TASK_STATUS.includes(req.query.status)
      ? req.query.status
      : "";
    let query = `
            SELECT t.*, u.nome as professor_nome,
                COUNT(ta.id) as total_alunos,
                COUNT(CASE WHEN ta.status = 'CONCLUIDA' THEN 1 END) as concluidas,
                COUNT(CASE WHEN ta.status = 'ENTREGUE' THEN 1 END) as entregues,
                COUNT(CASE WHEN ta.status = 'DEVOLVIDA' THEN 1 END) as devolvidas,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 1 END) as atrasadas,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND t.data_entrega >= CURRENT_DATE THEN 1 END) as pendentes
            FROM tarefas t
            LEFT JOIN usuarios u ON t.criado_por = u.id
            LEFT JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
            WHERE 1=1`;
    const params = [];
    if (turmaFilter) {
      params.push(turmaFilter);
      query += ` AND t.turma = $${params.length}`;
    }
    if (statusFilter) {
      params.push(statusFilter);
      query += ` AND t.status = $${params.length}`;
    }
    query += ` GROUP BY t.id, u.nome ORDER BY CASE WHEN t.status = 'ATIVA' THEN 1 ELSE 2 END, t.data_criacao DESC`;

    const [tarefasResult, alunosResult, statsResult, competenciasResult] =
      await Promise.all([
        db.query(query, params),
        db.query("SELECT id, nome, ano_escolar FROM alunos ORDER BY nome ASC"),
        db.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ATIVA' THEN 1 END) as ativas,
                COUNT(CASE WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN 1 END) as atrasadas,
                (SELECT COUNT(*) FROM tarefas_alunos WHERE status = 'ENTREGUE') as aguardando_correcao FROM tarefas`),
        db.query("SELECT id, nome FROM competencias ORDER BY nome ASC"),
      ]);

    res.render("dashboard/dashboardTarefas", {
      tarefas: tarefasResult.rows,
      alunos: alunosResult.rows,
      stats: statsResult.rows[0],
      user: req.session.user,
      userCargo: req.session.userCargo,
      listaCompetencias: competenciasResult.rows,
      filtros: { turma: turmaFilter, status: statusFilter },
    });
  } catch (err) {
    console.error("Erro ao carregar tarefas:", err);
    req.flash("error_msg", "Erro ao carregar tarefas");
    res.redirect("/dashboard");
  }
};

exports.criar = async (req, res) => {
  const titulo = text(req.body.titulo, 200, { min: 1 });
  const descricao = text(req.body.descricao, 5000) || null;
  const turma = ALLOWED_YEARS.includes(req.body.turma) ? req.body.turma : null;
  const data_entrega = req.body.data_entrega
    ? dateOnly(req.body.data_entrega)
    : null;
  const prioridade = ALLOWED_PRIORITY.includes(req.body.prioridade)
    ? req.body.prioridade
    : "MEDIA";
  const competencia_id = req.body.competencia_id
    ? integerId(req.body.competencia_id)
    : null;
  const alunos = Array.isArray(req.body.alunos)
    ? req.body.alunos.map(integerId).filter(Boolean).slice(0, 500)
    : [];
  if (
    !titulo ||
    !turma ||
    (req.body.data_entrega && !data_entrega) ||
    (req.body.competencia_id && !competencia_id)
  ) {
    req.flash("error_msg", "Título e turma são obrigatórios");
    return res.redirect("/dashboard/tarefas");
  }

  const client = await db.connect();
  const notificationAlunoIds = [];
  try {
    await client.query("BEGIN");
    const tarefaResult = await client.query(
      `INSERT INTO tarefas (titulo, descricao, turma, data_entrega, prioridade, competencia_id, criado_por, data_atualizacao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id`,
      [
        titulo,
        descricao,
        turma,
        data_entrega,
        prioridade,
        competencia_id,
        req.session.userId,
      ],
    );
    const tarefaId = tarefaResult.rows[0].id;
    let alunosParaAtribuir = alunos;
    if (alunosParaAtribuir.length === 0) {
      const alunosTurma = await client.query(
        "SELECT id FROM alunos WHERE ano_escolar = $1 ORDER BY id",
        [turma],
      );
      alunosParaAtribuir = alunosTurma.rows.map((row) => row.id);
    } else {
      const valid = await client.query(
        "SELECT id FROM alunos WHERE ano_escolar = $1 AND id = ANY($2::int[])",
        [turma, alunosParaAtribuir],
      );
      alunosParaAtribuir = valid.rows.map((row) => row.id);
    }
    for (const alunoId of [...new Set(alunosParaAtribuir)]) {
      const inserted = await client.query(
        `INSERT INTO tarefas_alunos (tarefa_id, aluno_id, status)
                 VALUES ($1, $2, 'PENDENTE')
                 ON CONFLICT (tarefa_id, aluno_id) DO NOTHING
                 RETURNING aluno_id`,
        [tarefaId, alunoId],
      );
      if (inserted.rows[0])
        notificationAlunoIds.push(inserted.rows[0].aluno_id);
    }
    await client.query("COMMIT");

    for (const alunoId of notificationAlunoIds) {
      await criarNotificacao(
        "tarefa",
        null,
        alunoId,
        "Nova Tarefa",
        `Você recebeu uma nova tarefa: ${titulo}`,
        "/aluno/tarefas",
        "fas fa-tasks",
        "#217346",
      );
    }
    req.flash("success_msg", "Tarefa criada com sucesso!");
    res.redirect("/dashboard/tarefas");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar tarefa:", err);
    req.flash("error_msg", "Erro ao criar tarefa");
    res.redirect("/dashboard/tarefas");
  } finally {
    client.release();
  }
};

exports.avaliarAluno = async (req, res) => {
  const tarefa_id = integerId(req.body.tarefa_id);
  const aluno_id = integerId(req.body.aluno_id);
  const nota = numberInRange(req.body.nota, 0, 10);
  const feedback = text(req.body.feedback, 5000) || null;
  if (!tarefa_id || !aluno_id || nota === null)
    return res
      .status(400)
      .json({ success: false, error: "Dados de avaliação inválidos." });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE tarefas_alunos SET nota = $1, feedback = $2, status = 'CONCLUIDA', data_avaliacao = CURRENT_TIMESTAMP
             WHERE tarefa_id = $3 AND aluno_id = $4 RETURNING id`,
      [nota, feedback, tarefa_id, aluno_id],
    );
    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, error: "Entrega não encontrada." });
    }
    const tarefa = await client.query(
      "SELECT competencia_id FROM tarefas WHERE id = $1",
      [tarefa_id],
    );
    let virouCompetencia = false;
    if (tarefa.rows[0]?.competencia_id) {
      await client.query(
        `INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)`,
        [
          aluno_id,
          tarefa.rows[0].competencia_id,
          nota,
          "Avaliado pelo professor",
        ],
      );
      virouCompetencia = true;
      const media = await client.query(
        "SELECT AVG(nota) as media FROM aluno_competencias WHERE aluno_id = $1",
        [aluno_id],
      );
      if (media.rows[0].media)
        await client.query("UPDATE alunos SET nota = $1 WHERE id = $2", [
          media.rows[0].media,
          aluno_id,
        ]);
    }
    await client.query("COMMIT");
    await criarNotificacao(
      "avaliacao",
      null,
      aluno_id,
      "Tarefa Avaliada",
      `Sua tarefa foi avaliada com nota ${nota}`,
      "/aluno/tarefas",
      "fas fa-star",
      "#217346",
    );
    res.json({ success: true, virouCompetencia });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao avaliar tarefa:", err);
    res.status(500).json({ success: false, error: "Erro ao avaliar tarefa." });
  } finally {
    client.release();
  }
};

exports.devolverAluno = async (req, res) => {
  const tarefa_id = integerId(req.body.tarefa_id);
  const aluno_id = integerId(req.body.aluno_id);
  if (!tarefa_id || !aluno_id)
    return res.status(400).json({ success: false, error: "Dados inválidos." });
  try {
    const result = await db.query(
      `UPDATE tarefas_alunos SET status = 'DEVOLVIDA', nota = NULL, feedback = NULL, data_avaliacao = NULL
             WHERE tarefa_id = $1 AND aluno_id = $2 RETURNING id`,
      [tarefa_id, aluno_id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Entrega não encontrada." });
    await criarNotificacao(
      "devolucao",
      null,
      aluno_id,
      "Tarefa Devolvida",
      "Sua tarefa foi devolvida para correção",
      "/aluno/tarefas",
      "fas fa-undo-alt",
      "#ffa500",
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao devolver tarefa:", err);
    res.status(500).json({ success: false, error: "Erro ao devolver tarefa." });
  }
};

exports.obterDetalhes = async (req, res) => {
  const tarefaId = integerId(req.params.id);
  if (!tarefaId) return res.status(400).json({ error: "Tarefa inválida" });
  try {
    const tarefaResult = await db.query(
      `SELECT t.*, c.nome as competencia_nome, u.nome as professor_nome
            FROM tarefas t LEFT JOIN competencias c ON t.competencia_id = c.id LEFT JOIN usuarios u ON t.criado_por = u.id WHERE t.id = $1`,
      [tarefaId],
    );
    if (tarefaResult.rows.length === 0)
      return res.status(404).json({ error: "Tarefa não encontrada" });
    const alunosResult = await db.query(
      `
            SELECT a.id, a.nome, a.ano_escolar, COALESCE(ta.status, 'PENDENTE') as status_tarefa,
                ta.nota, ta.feedback, ta.resposta_texto, ta.resposta_arquivo, ta.data_entrega as data_entrega_aluno,
                ta.data_avaliacao, TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as data_entrega_formatada
            FROM alunos a LEFT JOIN tarefas_alunos ta ON a.id = ta.aluno_id AND ta.tarefa_id = $1
            WHERE a.ano_escolar = $2
            ORDER BY CASE WHEN ta.status = 'ENTREGUE' THEN 1 WHEN ta.status = 'DEVOLVIDA' THEN 2 WHEN ta.status = 'PENDENTE' THEN 3 ELSE 4 END, a.nome ASC`,
      [tarefaId, tarefaResult.rows[0].turma],
    );
    res.json({ tarefa: tarefaResult.rows[0], alunos: alunosResult.rows });
  } catch (err) {
    console.error("Erro ao buscar tarefa:", err);
    res.status(500).json({ error: "Erro ao buscar tarefa" });
  }
};

exports.editar = async (req, res) => {
  const tarefaId = integerId(req.params.id);
  const titulo = text(req.body.titulo, 200, { min: 1 });
  const descricao = text(req.body.descricao, 5000) || null;
  const data_entrega = req.body.data_entrega
    ? dateOnly(req.body.data_entrega)
    : null;
  const prioridade = ALLOWED_PRIORITY.includes(req.body.prioridade)
    ? req.body.prioridade
    : null;
  const status = ALLOWED_TASK_STATUS.includes(req.body.status)
    ? req.body.status
    : null;
  if (
    !tarefaId ||
    !titulo ||
    !prioridade ||
    !status ||
    (req.body.data_entrega && !data_entrega)
  ) {
    req.flash("error_msg", "Dados da tarefa inválidos.");
    return res.redirect("/dashboard/tarefas");
  }
  try {
    await db.query(
      `UPDATE tarefas SET titulo = $1, descricao = $2, data_entrega = $3, prioridade = $4, status = $5, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $6`,
      [titulo, descricao, data_entrega, prioridade, status, tarefaId],
    );
    req.flash("success_msg", "Tarefa atualizada com sucesso!");
    res.redirect("/dashboard/tarefas");
  } catch (err) {
    console.error("Erro ao editar tarefa:", err);
    req.flash("error_msg", "Erro ao editar tarefa");
    res.redirect("/dashboard/tarefas");
  }
};

exports.excluir = async (req, res) => {
  const tarefaId = integerId(req.params.id);
  if (!tarefaId) {
    req.flash("error_msg", "Tarefa inválida");
    return res.redirect("/dashboard/tarefas");
  }
  try {
    await db.query("DELETE FROM tarefas WHERE id = $1", [tarefaId]);
    req.flash("success_msg", "Tarefa excluída com sucesso!");
    res.redirect("/dashboard/tarefas");
  } catch (err) {
    console.error("Erro ao excluir tarefa:", err);
    req.flash("error_msg", "Erro ao excluir tarefa");
    res.redirect("/dashboard/tarefas");
  }
};

exports.atualizarStatusAluno = async (req, res) => {
  const tarefa_id = integerId(req.body.tarefa_id);
  const aluno_id = integerId(req.body.aluno_id);
  const status = [
    "PENDENTE",
    "ENTREGUE",
    "CONCLUIDA",
    "DEVOLVIDA",
    "ATRASADA",
  ].includes(req.body.status)
    ? req.body.status
    : null;
  const observacoes = text(req.body.observacoes, 2000) || null;
  if (!tarefa_id || !aluno_id || !status)
    return res.status(400).json({ error: "Dados inválidos" });
  try {
    await db.query(
      `UPDATE tarefas_alunos SET status = $1, data_entrega = CASE WHEN $1 = 'CONCLUIDA' THEN CURRENT_TIMESTAMP ELSE data_entrega END WHERE tarefa_id = $2 AND aluno_id = $3`,
      [status, tarefa_id, aluno_id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar status:", err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
};

exports.estatisticas = async (req, res) => {
  try {
    const result =
      await db.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ATIVA' THEN 1 END) as ativas,
            COUNT(CASE WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN 1 END) as atrasadas,
            COUNT(CASE WHEN prioridade = 'ALTA' AND status = 'ATIVA' THEN 1 END) as prioridade_alta FROM tarefas`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
};
