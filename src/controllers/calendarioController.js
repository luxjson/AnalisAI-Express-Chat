const db = require("../db");
const {
  text,
  integerId,
  hexColor,
  dateOnly,
  ALLOWED_YEARS,
} = require("../utils/validation");

exports.listar = async (req, res) => {
  try {
    const turmaFilter = ALLOWED_YEARS.includes(req.query.turma)
      ? req.query.turma
      : "";
    const mes =
      Number(req.query.mes) >= 1 && Number(req.query.mes) <= 12
        ? Number(req.query.mes)
        : new Date().getMonth() + 1;
    const ano =
      Number(req.query.ano) >= 2000 && Number(req.query.ano) <= 2100
        ? Number(req.query.ano)
        : new Date().getFullYear();
    let eventosQuery = `SELECT * FROM calendario_eventos WHERE data_inicio <= make_date($2::int, $1::int, 1) + INTERVAL '1 month' - INTERVAL '1 day' AND COALESCE(data_fim, data_inicio) >= make_date($2::int, $1::int, 1)`;
    const params = [mes, ano];
    if (turmaFilter) {
      params.push(turmaFilter);
      eventosQuery += ` AND (turma = $3 OR turma IS NULL)`;
    }
    eventosQuery += " ORDER BY data_inicio ASC";

    const [eventosResult, feriadosResult, tiposResult] = await Promise.all([
      db.query(eventosQuery, params),
      db.query(
        `SELECT * FROM feriados WHERE (EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2) OR (recorrente = true AND EXTRACT(MONTH FROM data) = $1) ORDER BY CASE WHEN EXTRACT(YEAR FROM data) = $2 THEN 0 ELSE 1 END, data ASC`,
        [mes, ano],
      ),
      db.query(
        "SELECT tipo, COUNT(*) as total, MIN(cor) as cor FROM calendario_eventos GROUP BY tipo ORDER BY total DESC",
      ),
    ]);
    res.render("dashboard/dashboardCalendario", {
      user: req.session.user,
      userCargo: req.session.userCargo,
      eventos: eventosResult.rows,
      feriados: feriadosResult.rows,
      tipos: tiposResult.rows,
      filtros: { turma: turmaFilter, mes, ano },
    });
  } catch (err) {
    console.error("Erro ao carregar calendário:", err);
    req.flash("error_msg", "Erro ao carregar calendário");
    res.redirect("/dashboard");
  }
};

function validDate(value) {
  return dateOnly(value);
}

exports.criarEvento = async (req, res) => {
  const titulo = text(req.body.titulo, 200, { min: 1 });
  const descricao = text(req.body.descricao, 5000) || null;
  const tipo = text(req.body.tipo, 50, { min: 1 });
  const data_inicio = validDate(req.body.data_inicio);
  const data_fim = req.body.data_fim ? validDate(req.body.data_fim) : null;
  const turma = req.body.turma
    ? ALLOWED_YEARS.includes(req.body.turma)
      ? req.body.turma
      : null
    : null;
  const cor = req.body.cor ? hexColor(req.body.cor) : "#ff0101";
  if (
    !titulo ||
    !data_inicio ||
    !tipo ||
    (req.body.cor && !cor) ||
    (req.body.data_fim && !data_fim) ||
    (data_fim && data_fim < data_inicio)
  ) {
    req.flash("error_msg", "Dados do evento inválidos.");
    return res.redirect("/dashboard/calendario");
  }
  try {
    await db.query(
      `INSERT INTO calendario_eventos (titulo, descricao, tipo, data_inicio, data_fim, turma, cor, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        titulo,
        descricao,
        tipo,
        data_inicio,
        data_fim,
        turma,
        cor,
        req.session.userId,
      ],
    );
    req.flash("success_msg", "Evento adicionado com sucesso!");
    res.redirect("/dashboard/calendario");
  } catch (err) {
    console.error("Erro ao criar evento:", err);
    req.flash("error_msg", "Erro ao criar evento");
    res.redirect("/dashboard/calendario");
  }
};

exports.criarFeriado = async (req, res) => {
  const nome = text(req.body.nome, 200, { min: 1 });
  const data = validDate(req.body.data);
  if (!nome || !data) {
    req.flash("error_msg", "Nome e data são obrigatórios");
    return res.redirect("/dashboard/calendario");
  }
  try {
    await db.query(
      "INSERT INTO feriados (nome, data, recorrente) VALUES ($1,$2,$3) ON CONFLICT (data,nome) DO NOTHING",
      [nome, data, req.body.recorrente === "true"],
    );
    req.flash("success_msg", "Feriado adicionado com sucesso!");
    res.redirect("/dashboard/calendario");
  } catch (err) {
    console.error("Erro ao adicionar feriado:", err);
    req.flash("error_msg", "Erro ao adicionar feriado");
    res.redirect("/dashboard/calendario");
  }
};

exports.deletarEvento = async (req, res) => {
  const id = integerId(req.params.id);
  if (!id)
    return res.status(400).json({ success: false, error: "ID inválido" });
  try {
    const result = await db.query(
      "DELETE FROM calendario_eventos WHERE id = $1 AND (criado_por = $2 OR $3 = true) RETURNING id",
      [id, req.session.userId, req.session.userCargo === "Admin"],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, error: "Evento não encontrado" });
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar evento:", err);
    res.status(500).json({ success: false });
  }
};

exports.deletarFeriado = async (req, res) => {
  const id = integerId(req.params.id);
  if (!id)
    return res.status(400).json({ success: false, error: "ID inválido" });
  try {
    await db.query("DELETE FROM feriados WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar feriado:", err);
    res.status(500).json({ success: false });
  }
};

exports.dadosMes = async (req, res) => {
  const mes = Number(req.query.mes);
  const ano = Number(req.query.ano);
  const turma = ALLOWED_YEARS.includes(req.query.turma) ? req.query.turma : "";
  if (
    !Number.isInteger(mes) ||
    mes < 1 ||
    mes > 12 ||
    !Number.isInteger(ano) ||
    ano < 2000 ||
    ano > 2100
  )
    return res.status(400).json({ error: "Período inválido" });
  try {
    const eventos = await db.query(
      `SELECT * FROM calendario_eventos WHERE data_inicio <= make_date($2::int, $1::int, 1) + INTERVAL '1 month' - INTERVAL '1 day' AND COALESCE(data_fim, data_inicio) >= make_date($2::int, $1::int, 1) AND (turma = $3 OR turma IS NULL) ORDER BY data_inicio ASC`,
      [mes, ano, turma],
    );
    const feriados = await db.query(
      "SELECT * FROM feriados WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2",
      [mes, ano],
    );
    res.json({ eventos: eventos.rows, feriados: feriados.rows });
  } catch (err) {
    console.error("Erro ao buscar dados do calendário:", err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};
