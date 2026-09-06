const db = require("../db");
const { integerId, text } = require("../utils/validation");
const {
  generateResponse,
  isDirectAnswerRequest,
  STUDENT_INSTRUCTION,
  TEACHER_INSTRUCTION,
  MAX_MESSAGE_LENGTH,
} = require("../services/aiService");

function requestData(req) {
  const message = text(req.body?.message, MAX_MESSAGE_LENGTH, { min: 1 });
  const conversationId = integerId(req.body?.conversationId);
  return { message, conversationId };
}

function conversationTitle(message) {
  const title = message
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return title.length > 58
    ? `${title.slice(0, 55)}...`
    : title || "Nova conversa";
}

function ownerFilter(req) {
  if (req.session?.aluno?.id)
    return { column: "aluno_id", id: req.session.aluno.id };
  return { column: "usuario_id", id: req.session.userId };
}

async function createConversation(req, title = "Nova conversa") {
  const owner = ownerFilter(req);
  const result = await db.query(
    `INSERT INTO ia_conversas (${owner.column}, titulo) VALUES ($1, $2) RETURNING id, titulo, fixado, data_criacao, data_atualizacao`,
    [owner.id, title.slice(0, 120)],
  );
  return result.rows[0];
}

async function findConversation(req, conversationId) {
  if (!conversationId) return null;
  const owner = ownerFilter(req);
  const result = await db.query(
    `SELECT id, titulo FROM ia_conversas WHERE id = $1 AND ${owner.column} = $2`,
    [conversationId, owner.id],
  );
  return result.rows[0] || null;
}

async function saveMessage(conversationId, papel, conteudo) {
  await db.query(
    "INSERT INTO ia_mensagens (conversa_id, papel, conteudo) VALUES ($1, $2, $3)",
    [conversationId, papel, conteudo],
  );
  await db.query(
    "UPDATE ia_conversas SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1",
    [conversationId],
  );
}

async function updateConversationTitle(conversationId, title) {
  await db.query(
    `UPDATE ia_conversas SET titulo = CASE WHEN titulo = 'Nova conversa' THEN $1 ELSE titulo END WHERE id = $2`,
    [conversationTitle(title), conversationId],
  );
}

async function persistExchange(req, conversation, message, answer) {
  const savedConversation =
    conversation || (await createConversation(req, message));
  await saveMessage(savedConversation.id, "user", message);
  await saveMessage(savedConversation.id, "model", answer);
  await updateConversationTitle(savedConversation.id, message);
  return savedConversation;
}

async function detectGradeAction(message) {
  const match = message.match(
    /altera(?:r)?\s+(?:a\s+)?nota\s+de\s+(.+?)\s+em\s+(.+?)\s+(?:para|pra)\s+(10(?:[.,]0)?|[0-9](?:[.,][0-9])?)/i,
  );
  if (!match) return null;
  const nota = Number(match[3].replace(",", "."));
  if (!Number.isFinite(nota) || nota < 0 || nota > 10) return null;
  const [student, competency] = await Promise.all([
    db.query(
      "SELECT id, nome FROM alunos WHERE LOWER(nome) = LOWER($1) LIMIT 1",
      [match[1].trim()],
    ),
    db.query(
      "SELECT id, nome FROM competencias WHERE LOWER(nome) = LOWER($1) LIMIT 1",
      [match[2].trim()],
    ),
  ]);
  if (!student.rows[0] || !competency.rows[0]) return null;
  return {
    alunoId: student.rows[0].id,
    alunoNome: student.rows[0].nome,
    competenciaId: competency.rows[0].id,
    competenciaNome: competency.rows[0].nome,
    nota,
  };
}

async function getConversationHistory(conversationId) {
  const result = await db.query(
    "SELECT papel AS role, conteudo AS text FROM ia_mensagens WHERE conversa_id = $1 ORDER BY data_criacao DESC LIMIT 8",
    [conversationId],
  );
  return result.rows.reverse();
}

exports.history = async (req, res) => {
  try {
    const owner = ownerFilter(req);
    const conversations = await db.query(
      `SELECT id, titulo, fixado, data_criacao, data_atualizacao FROM ia_conversas WHERE ${owner.column} = $1 ORDER BY fixado DESC, data_atualizacao DESC LIMIT 50`,
      [owner.id],
    );
    if (conversations.rows.length === 0) return res.json({ conversations: [] });
    const ids = conversations.rows.map((row) => row.id);
    const messages = await db.query(
      "SELECT conversa_id, papel AS role, conteudo AS text FROM ia_mensagens WHERE conversa_id = ANY($1::int[]) ORDER BY data_criacao ASC",
      [ids],
    );
    const messagesByConversation = new Map(ids.map((id) => [id, []]));
    messages.rows.forEach((message) =>
      messagesByConversation
        .get(message.conversa_id)
        .push({ role: message.role, text: message.text }),
    );
    return res.json({
      conversations: conversations.rows.map((conversation) => ({
        ...conversation,
        messages: messagesByConversation.get(conversation.id),
      })),
    });
  } catch (error) {
    return sendAiError(res, error);
  }
};

function sendAiError(res, error, extra = {}) {
  if (error.code === "AI_NOT_CONFIGURED")
    return res
      .status(503)
      .json({ error: "A IA ainda não foi configurada no servidor.", ...extra });
  if (error.code === "AI_QUOTA_ERROR")
    return res
      .status(429)
      .json({ error: "O limite gratuito da IA foi atingido.", ...extra });
  if (error.code === "AI_PROVIDER_ERROR")
    return res
      .status(502)
      .json({
        error: "O serviço de IA não respondeu. Tente novamente em instantes.",
        ...extra,
      });
  if (error.name === "TimeoutError" || error.name === "AbortError")
    return res
      .status(504)
      .json({
        error: "A IA demorou mais que o esperado. Tente novamente.",
        ...extra,
      });
  console.error("Erro na IA:", error);
  return res
    .status(500)
    .json({ error: "Não foi possível gerar a resposta.", ...extra });
}

async function getStudentContext(alunoId) {
  const [student, competencies, tasks] = await Promise.all([
    db.query(
      "SELECT nome, ano_escolar, idade, presenca, nota, nivel FROM alunos WHERE id = $1",
      [alunoId],
    ),
    db.query(
      `SELECT c.nome, c.categoria, ac.nota, ac.observacoes, TO_CHAR(ac.data_registro, 'DD/MM/YYYY') AS data
                  FROM aluno_competencias ac JOIN competencias c ON c.id = ac.competencia_id
                  WHERE ac.aluno_id = $1 ORDER BY ac.data_registro DESC LIMIT 80`,
      [alunoId],
    ),
    db.query(
      `SELECT t.titulo, t.descricao, t.data_entrega, t.competencia_id, ta.status, ta.nota, ta.feedback
                  FROM tarefas_alunos ta JOIN tarefas t ON t.id = ta.tarefa_id
                  WHERE ta.aluno_id = $1 ORDER BY t.data_entrega DESC NULLS LAST LIMIT 40`,
      [alunoId],
    ),
  ]);
  return {
    aluno: student.rows[0],
    competencias: competencies.rows,
    tarefas: tasks.rows,
  };
}

exports.studentPage = (req, res) =>
  res.render("aluno/alunoIA", {
    aluno: req.session.aluno,
    user: req.session.aluno?.nome,
    userCargo: "Aluno",
    isAdmin: false,
  });

exports.teacherPage = (req, res) =>
  res.render("dashboard/dashboardIA", {
    user: req.session.user,
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === "Admin",
  });

exports.studentChat = async (req, res) => {
  const { message, conversationId } = requestData(req);
  if (!message) return res.status(400).json({ error: "Digite uma pergunta." });
  let conversation;
  try {
    conversation = await findConversation(req, conversationId);
    const history = conversation
      ? await getConversationHistory(conversation.id)
      : [];
    if (isDirectAnswerRequest(message)) {
      const answer =
        "Posso ajudar você a entender o conteúdo e montar os passos da solução, mas não posso entregar uma atividade, prova ou exercício pronto. Envie o enunciado ou diga qual parte ficou difícil.";
      conversation = await persistExchange(req, conversation, message, answer);
      return res.json({ answer, conversationId: conversation.id });
    }
    const context = await getStudentContext(req.session.aluno.id);
    const answer = await generateResponse({
      systemInstruction: STUDENT_INSTRUCTION,
      context,
      message,
      history,
    });
    conversation = await persistExchange(req, conversation, message, answer);
    return res.json({ answer, conversationId: conversation.id });
  } catch (error) {
    return sendAiError(
      res,
      error,
      conversation?.id ? { conversationId: conversation.id } : {},
    );
  }
};

exports.teacherChat = async (req, res) => {
  const { message, conversationId } = requestData(req);
  if (!message) return res.status(400).json({ error: "Digite uma pergunta." });
  let conversation;
  try {
    conversation = await findConversation(req, conversationId);
    const history = conversation
      ? await getConversationHistory(conversation.id)
      : [];
    const gradeAction = await detectGradeAction(message);
    if (gradeAction) {
      const answer = `Encontrei a alteração para ${gradeAction.alunoNome}, competência ${gradeAction.competenciaNome} e nota ${gradeAction.nota}. Confirme abaixo para aplicar.`;
      conversation = await persistExchange(req, conversation, message, answer);
      return res.json({
        answer,
        conversationId: conversation.id,
        action: { type: "update_grade", ...gradeAction },
      });
    }
    const [students, competencies, tasks] = await Promise.all([
      db.query(`SELECT a.id, a.nome, a.ano_escolar, a.presenca, a.nota, a.nivel,
                      COALESCE(json_agg(json_build_object('nome', c.nome, 'nota', ac.nota, 'observacoes', ac.observacoes))
                      FILTER (WHERE c.id IS NOT NULL), '[]') AS competencias
                      FROM alunos a LEFT JOIN aluno_competencias ac ON ac.aluno_id = a.id
                      LEFT JOIN competencias c ON c.id = ac.competencia_id
                      GROUP BY a.id ORDER BY a.nome LIMIT 200`),
      db.query(
        "SELECT id, nome, categoria, descricao FROM competencias ORDER BY nome",
      ),
      db.query(`SELECT t.titulo, t.turma, t.data_entrega, ta.status, ta.nota, ta.feedback
                      FROM tarefas t JOIN tarefas_alunos ta ON ta.tarefa_id = t.id
                      ORDER BY t.data_entrega DESC NULLS LAST LIMIT 300`),
    ]);
    const context = {
      alunos: students.rows,
      competencias: competencies.rows,
      tarefas: tasks.rows,
    };
    const answer = await generateResponse({
      systemInstruction: TEACHER_INSTRUCTION,
      context,
      message,
      history,
    });
    conversation = await persistExchange(req, conversation, message, answer);
    return res.json({ answer, conversationId: conversation.id });
  } catch (error) {
    return sendAiError(
      res,
      error,
      conversation?.id ? { conversationId: conversation.id } : {},
    );
  }
};

exports.analyzeStudent = async (req, res) => {
  const alunoId = integerId(req.params.id);
  if (!alunoId) return res.status(400).json({ error: "Aluno inválido." });
  try {
    const context = await getStudentContext(alunoId);
    if (!context.aluno)
      return res.status(404).json({ error: "Aluno não encontrado." });
    const message =
      text(req.body?.message, MAX_MESSAGE_LENGTH, { min: 1 }) ||
      "Faça um diagnóstico pedagógico conciso deste aluno. Liste situação atual, pontos fortes, prioridades de intervenção e próximos passos práticos.";
    const answer = await generateResponse({
      systemInstruction: TEACHER_INSTRUCTION,
      context,
      message,
      history: [],
    });
    return res.json({ answer });
  } catch (error) {
    return sendAiError(res, error);
  }
};

exports.updateGrade = async (req, res) => {
  const alunoId = integerId(req.body?.alunoId);
  const competenciaId = integerId(req.body?.competenciaId);
  const nota = Number(req.body?.nota);
  if (
    !alunoId ||
    !competenciaId ||
    !Number.isFinite(nota) ||
    nota < 0 ||
    nota > 10 ||
    req.body?.confirm !== true
  ) {
    return res
      .status(400)
      .json({ error: "Confirmação ou dados da nota inválidos." });
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query(
      `SELECT id, nota FROM aluno_competencias WHERE aluno_id = $1 AND competencia_id = $2 ORDER BY data_registro DESC, id DESC LIMIT 1`,
      [alunoId, competenciaId],
    );
    if (previous.rows[0]) {
      await client.query(
        "UPDATE aluno_competencias SET nota = $1, observacoes = COALESCE(observacoes, 'Alterado pelo professor via IA') WHERE id = $2",
        [nota, previous.rows[0].id],
      );
    } else {
      await client.query(
        "INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)",
        [alunoId, competenciaId, nota, "Registrado pelo professor via IA"],
      );
    }
    await client.query(
      `UPDATE alunos SET nota = COALESCE((SELECT AVG(nota) FROM aluno_competencias WHERE aluno_id = $1), 0) WHERE id = $1`,
      [alunoId],
    );
    await client.query(
      `INSERT INTO ia_auditoria_notas (usuario_id, aluno_id, competencia_id, nota_anterior, nota_nova) VALUES ($1, $2, $3, $4, $5)`,
      [
        req.session.userId,
        alunoId,
        competenciaId,
        previous.rows[0]?.nota || null,
        nota,
      ],
    );
    await client.query("COMMIT");
    return res.json({ success: true, message: "Nota atualizada com sucesso." });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendAiError(res, error);
  } finally {
    client.release();
  }
};

exports.updateConversation = async (req, res) => {
  const conversationId = integerId(req.params.id);
  const owner = ownerFilter(req);
  const title = text(req.body?.titulo, 120, { min: 1 });
  if (!conversationId)
    return res.status(400).json({ error: "Conversa inválida." });
  if (req.body?.acao === "renomear" && !title)
    return res.status(400).json({ error: "Informe um nome válido." });
  try {
    let result;
    if (req.body?.acao === "apagar") {
      result = await db.query(
        `DELETE FROM ia_conversas WHERE id = $1 AND ${owner.column} = $2 RETURNING id`,
        [conversationId, owner.id],
      );
    } else if (req.body?.acao === "fixar") {
      result = await db.query(
        `UPDATE ia_conversas SET fixado = NOT fixado WHERE id = $1 AND ${owner.column} = $2 RETURNING id, fixado`,
        [conversationId, owner.id],
      );
    } else if (req.body?.acao === "renomear") {
      result = await db.query(
        `UPDATE ia_conversas SET titulo = $1 WHERE id = $2 AND ${owner.column} = $3 RETURNING id, titulo`,
        [title, conversationId, owner.id],
      );
    } else {
      return res.status(400).json({ error: "Ação inválida." });
    }
    if (!result.rows.length)
      return res.status(404).json({ error: "Conversa não encontrada." });
    return res.json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    return sendAiError(res, error);
  }
};
