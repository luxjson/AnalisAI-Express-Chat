const db = require("../db");
const fs = require("fs");
const path = require("path");
const { criarNotificacao } = require("../utils/notificacao");
const upload = require("../middlewares/upload");
const fileStore = require("../fileStore");
const bcrypt = require("bcryptjs");
const {
  text,
  integerId,
  password,
  numberInRange,
  booleanValue,
  ALLOWED_YEARS,
} = require("../utils/validation");

exports.dashboard = async (req, res) => {
  try {
    const alunoId = req.session.aluno.id;
    const alunoResult = await db.query(
      `
            SELECT 
                a.*,
                al.matricula,
                al.email,
                al.status,
                TO_CHAR(al.data_criacao, 'DD/MM/YYYY') as data_cadastro
            FROM alunos a
            JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `,
      [alunoId],
    );
    if (alunoResult.rows.length === 0) {
      req.flash("error_msg", "Aluno não encontrado");
      return res.redirect("/logout");
    }
    const aluno = alunoResult.rows[0];
    const competenciasResult = await db.query(
      `
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `,
      [alunoId],
    );
    const competencias = competenciasResult.rows;
    let mediaGeral = 0;
    if (competencias.length > 0) {
      const soma = competencias.reduce(
        (acc, comp) => acc + parseFloat(comp.nota),
        0,
      );
      mediaGeral = soma / competencias.length;
    }
    const categoriasMap = new Map();
    competencias.forEach((comp) => {
      if (!categoriasMap.has(comp.categoria)) {
        categoriasMap.set(comp.categoria, {
          categoria: comp.categoria,
          soma: 0,
          count: 0,
          media: 0,
        });
      }
      const cat = categoriasMap.get(comp.categoria);
      cat.soma += parseFloat(comp.nota);
      cat.count++;
      cat.media = (cat.soma / cat.count) * 10;
    });
    const categorias = Array.from(categoriasMap.values());
    await db.query(
      "UPDATE alunos_login SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' WHERE aluno_id = $1",
      [alunoId],
    );
    res.render("aluno/alunoDashboard", {
      aluno,
      competencias,
      mediaGeral,
      categorias,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    console.error("Erro no dashboard do aluno:", err);
    req.flash("error_msg", "Erro ao carregar dashboard");
    res.redirect("/logout");
  }
};

exports.competencias = async (req, res) => {
  try {
    const alunoId = req.session.aluno.id;
    const alunoResult = await db.query(
      "SELECT nome, ano_escolar FROM alunos WHERE id = $1",
      [alunoId],
    );
    const aluno = alunoResult.rows[0];
    const competenciasResult = await db.query(
      `
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada,
                TO_CHAR(ac.data_registro, 'HH24:MI') as hora_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `,
      [alunoId],
    );
    const stats = await db.query(
      `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE nota >= 7) as aptas,
                COUNT(*) FILTER (WHERE nota >= 5 AND nota < 7) as desenvolvimento,
                COUNT(*) FILTER (WHERE nota < 5) as inaptas,
                COALESCE(AVG(nota), 0) as media_geral
            FROM aluno_competencias
            WHERE aluno_id = $1
        `,
      [alunoId],
    );
    res.render("aluno/alunoCompetencias", {
      aluno,
      competencias: competenciasResult.rows,
      stats: stats.rows[0],
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    console.error("Erro ao carregar competências do aluno:", err);
    req.flash("error_msg", "Erro ao carregar competências");
    res.redirect("/aluno");
  }
};

exports.evolucao = async (req, res) => {
  try {
    const alunoId = req.session.aluno.id;
    const alunoResult = await db.query(
      "SELECT nome, ano_escolar, presenca FROM alunos WHERE id = $1",
      [alunoId],
    );
    const aluno = alunoResult.rows[0];
    const competenciasResult = await db.query(
      `
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `,
      [alunoId],
    );
    const competencias = competenciasResult.rows;
    const historicoResult = await db.query(
      `
            SELECT 
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data,
                COUNT(*) as total_avaliacoes,
                COALESCE(AVG(ac.nota), 0) as media_dia
            FROM aluno_competencias ac
            WHERE ac.aluno_id = $1
            GROUP BY TO_CHAR(ac.data_registro, 'DD/MM/YYYY')
            ORDER BY data DESC
        `,
      [alunoId],
    );
    const historico = historicoResult.rows;
    const categoriasMap = new Map();
    competencias.forEach((comp) => {
      if (!categoriasMap.has(comp.categoria)) {
        categoriasMap.set(comp.categoria, {
          categoria: comp.categoria,
          soma: 0,
          count: 0,
          media: 0,
        });
      }
      const cat = categoriasMap.get(comp.categoria);
      cat.soma += parseFloat(comp.nota);
      cat.count++;
      cat.media = (cat.soma / cat.count) * 10;
    });
    const categorias = Array.from(categoriasMap.values());
    res.render("aluno/alunoEvolucao", {
      aluno,
      competencias,
      historico,
      categorias,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    console.error("Erro ao carregar evolução:", err);
    req.flash("error_msg", "Erro ao carregar evolução");
    res.redirect("/aluno");
  }
};

exports.alterarSenha = async (req, res) => {
  const senha_atual =
    typeof req.body.senha_atual === "string" ? req.body.senha_atual : "";
  const nova_senha = password(req.body.nova_senha);
  const confirmar_senha =
    typeof req.body.confirmar_senha === "string"
      ? req.body.confirmar_senha
      : "";
  const alunoId = req.session.aluno.id;
  const voltar = () => res.redirect("/aluno?settings=account");
  try {
    const result = await db.query(
      "SELECT senha FROM alunos_login WHERE aluno_id = $1",
      [alunoId],
    );
    if (result.rows.length === 0) {
      req.flash("error_msg", "Aluno não encontrado");
      return voltar();
    }
    const senhaAtualValida = await bcrypt.compare(
      senha_atual,
      result.rows[0].senha,
    );
    if (!senhaAtualValida) {
      req.flash("error_msg", "Senha atual incorreta");
      return voltar();
    }
    if (!nova_senha) {
      req.flash("error_msg", "A nova senha deve ter entre 12 e 128 caracteres");
      return voltar();
    }
    if (nova_senha !== confirmar_senha) {
      req.flash("error_msg", "As senhas não coincidem");
      return voltar();
    }

    const novaSenhaHash = await bcrypt.hash(nova_senha, 12);
    await db.query("UPDATE alunos_login SET senha = $1 WHERE aluno_id = $2", [
      novaSenhaHash,
      alunoId,
    ]);
    if (process.env.NODE_ENV === "production") {
      await db.query(
        "DELETE FROM web_sessions WHERE sess->'aluno'->>'id' = $1",
        [String(alunoId)],
      );
    }
    const oldSessionData = { ...req.session.aluno };
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.aluno = oldSessionData;
    req.session.csrfToken = require("crypto").randomBytes(32).toString("hex");
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
    req.flash("success_msg", "Senha alterada com sucesso!");
    return voltar();
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    req.flash("error_msg", "Erro ao alterar senha");
    return voltar();
  }
};

exports.tarefas = async (req, res) => {
  try {
    const alunoId = req.session.aluno.id;
    await db.query(
      `
            UPDATE tarefas_alunos ta
            SET status = 'ATRASADA'
            FROM tarefas t
            WHERE ta.tarefa_id = t.id
              AND ta.aluno_id = $1
              AND ta.status = 'PENDENTE'
              AND t.data_entrega < CURRENT_DATE
        `,
      [alunoId],
    );
    const tarefasResult = await db.query(
      `
            SELECT 
                ta.id as tarefa_aluno_id,
                t.id as tarefa_id,
                t.titulo,
                t.descricao,
                t.turma,
                t.data_entrega as data_limite,
                c.nome as competencia_nome,
                ta.status,
                ta.nota,
                ta.feedback,
                ta.data_entrega as data_entrega_aluno,
                ta.data_avaliacao,
                TO_CHAR(t.data_entrega, 'DD/MM/YYYY') as data_limite_formatada,
                TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as data_entrega_formatada,
                TO_CHAR(ta.data_avaliacao, 'DD/MM/YYYY') as data_avaliacao_formatada,
                CASE 
                    WHEN ta.status = 'ENTREGUE' THEN 'Aguardando correção'
                    WHEN ta.status = 'CONCLUIDA' THEN 'Corrigida'
                    WHEN ta.status = 'DEVOLVIDA' THEN 'Devolvida para correção'
                    WHEN ta.status = 'ATRASADA' THEN 'Atrasada'
                    ELSE 'Pendente'
                END as status_texto,
                CASE
                    WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 'ATRASADA'
                    ELSE ta.status
                END as status_real
            FROM tarefas t
            JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
            LEFT JOIN competencias c ON t.competencia_id = c.id
            WHERE ta.aluno_id = $1
            ORDER BY 
                CASE 
                    WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 1
                    WHEN ta.status = 'PENDENTE' THEN 2
                    WHEN ta.status = 'DEVOLVIDA' THEN 3
                    WHEN ta.status = 'ENTREGUE' THEN 4
                    WHEN ta.status = 'CONCLUIDA' THEN 5
                    ELSE 6
                END,
                t.data_entrega ASC NULLS LAST
        `,
      [alunoId],
    );
    const statsResult = await db.query(
      `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND (t.data_entrega IS NULL OR t.data_entrega >= CURRENT_DATE) THEN 1 END) as pendentes,
                COUNT(CASE WHEN ta.status = 'ENTREGUE' THEN 1 END) as aguardando,
                COUNT(CASE WHEN ta.status = 'CONCLUIDA' THEN 1 END) as concluidas,
                COUNT(CASE WHEN ta.status = 'DEVOLVIDA' THEN 1 END) as devolvidas,
                COUNT(CASE WHEN ta.status = 'ATRASADA' OR (ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE) THEN 1 END) as atrasadas
            FROM tarefas_alunos ta
            JOIN tarefas t ON ta.tarefa_id = t.id
            WHERE ta.aluno_id = $1
        `,
      [alunoId],
    );
    res.render("aluno/alunoTarefas", {
      aluno: req.session.aluno,
      tarefas: tarefasResult.rows,
      stats: statsResult.rows[0] || {
        total: 0,
        pendentes: 0,
        aguardando: 0,
        concluidas: 0,
        devolvidas: 0,
        atrasadas: 0,
      },
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    console.error("Erro ao carregar tarefas do aluno:", err);
    req.flash("error_msg", "Erro ao carregar tarefas");
    res.redirect("/aluno");
  }
};

exports.enviarTarefa = async (req, res) => {
  const tarefaAlunoId = integerId(req.params.id);
  if (!tarefaAlunoId) {
    req.flash("error_msg", "Tarefa inválida");
    return res.redirect("/aluno/tarefas");
  }
  const alunoId = req.session.aluno.id;
  const resposta_texto = text(req.body.resposta_texto, 10000) || null;
  const arquivo = req.file;
  let storageKey = null;
  let oldStorageKey = null;

  if (!resposta_texto && !arquivo) {
    req.flash("error_msg", "Envie uma resposta em texto ou um arquivo.");
    return res.redirect("/aluno/tarefas");
  }

  try {
    const current = await db.query(
      `SELECT resposta_arquivo FROM tarefas_alunos WHERE id = $1 AND aluno_id = $2 AND status IN ('PENDENTE', 'DEVOLVIDA', 'ATRASADA')`,
      [tarefaAlunoId, alunoId],
    );
    if (current.rows.length === 0) {
      if (!process.env.VERCEL && arquivo?.path) {
        try {
          fs.unlinkSync(arquivo.path);
        } catch {}
      }
      req.flash(
        "error_msg",
        "Não foi possível enviar esta tarefa. Ela pode já ter sido entregue ou alterada.",
      );
      return res.redirect("/aluno/tarefas");
    }
    oldStorageKey = current.rows[0].resposta_arquivo || null;

    if (arquivo && arquivo.buffer && arquivo.size > 0) {
      const ext = require("path")
        .extname(arquivo.originalname || "")
        .toLowerCase();
      const head = arquivo.buffer.subarray(0, 12);
      const signaturesOk = [".jpg", ".jpeg"].includes(ext)
        ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
        : ext === ".png"
          ? head
              .slice(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : ext === ".pdf"
            ? head.slice(0, 5).toString("ascii") === "%PDF-"
            : [".zip", ".docx", ".xlsx", ".pptx"].includes(ext)
              ? head[0] === 0x50 && head[1] === 0x4b
              : ext === ".rar"
                ? head.slice(0, 7).toString("ascii") === "Rar!\x1a\x07" ||
                  head.slice(0, 8).toString("ascii") === "Rar!\x1a\x07\x01\x00"
                : true;
      if (!signaturesOk) {
        if (!process.env.VERCEL && arquivo?.path) {
          try {
            fs.unlinkSync(arquivo.path);
          } catch {}
        }
        req.flash(
          "error_msg",
          "O conteúdo do arquivo não corresponde ao formato informado.",
        );
        return res.redirect("/aluno/tarefas");
      }
    }

    if (arquivo && process.env.VERCEL) {
      storageKey = upload.makeStorageKey(arquivo);
      await fileStore.save({
        storageKey,
        originalName: String(arquivo.originalname || "arquivo").slice(0, 255),
        mimeType: arquivo.mimetype || "application/octet-stream",
        buffer: arquivo.buffer,
      });
    } else if (arquivo) {
      storageKey = arquivo.filename;
    }

    let query = `UPDATE tarefas_alunos
                     SET status = 'ENTREGUE',
                         data_entrega = CURRENT_TIMESTAMP`;
    const params = [];
    let paramIndex = 1;
    if (resposta_texto) {
      query += `, resposta_texto = $${paramIndex}`;
      params.push(resposta_texto);
      paramIndex++;
    }
    if (storageKey) {
      query += `, resposta_arquivo = $${paramIndex}`;
      params.push(storageKey);
      paramIndex++;
    }
    query += ` WHERE id = $${paramIndex} AND aluno_id = $${paramIndex + 1}
                   AND status IN ('PENDENTE', 'DEVOLVIDA', 'ATRASADA') RETURNING id`;
    params.push(tarefaAlunoId, alunoId);

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      if (process.env.VERCEL && storageKey)
        await fileStore.remove(storageKey).catch(() => {});
      if (!process.env.VERCEL && arquivo?.path) {
        try {
          require("fs").unlinkSync(arquivo.path);
        } catch {}
      }
      req.flash(
        "error_msg",
        "Não foi possível enviar esta tarefa. Ela pode já ter sido entregue ou alterada.",
      );
      return res.redirect("/aluno/tarefas");
    }

    if (!process.env.VERCEL && oldStorageKey && oldStorageKey !== storageKey) {
      try {
        fs.unlinkSync(
          require("path").join(__dirname, "../uploads", oldStorageKey),
        );
      } catch {}
    }

    const tarefaInfo = await db.query(
      "SELECT criado_por, titulo FROM tarefas WHERE id = (SELECT tarefa_id FROM tarefas_alunos WHERE id = $1)",
      [tarefaAlunoId],
    );
    if (tarefaInfo.rows[0]?.criado_por) {
      await criarNotificacao(
        "entrega",
        tarefaInfo.rows[0].criado_por,
        null,
        "Tarefa Entregue",
        `${req.session.aluno.nome} entregou a tarefa: ${tarefaInfo.rows[0].titulo}`,
        "/dashboard/tarefas",
        "fas fa-check-circle",
        "#ff0101",
      );
    }
    req.flash("success_msg", "Tarefa enviada com sucesso!");
    return res.redirect("/aluno/tarefas");
  } catch (err) {
    if (process.env.VERCEL && storageKey)
      await fileStore.remove(storageKey).catch(() => {});
    if (!process.env.VERCEL && arquivo?.path) {
      try {
        require("fs").unlinkSync(arquivo.path);
      } catch {}
    }
    console.error(
      "Erro ao enviar tarefa:",
      process.env.NODE_ENV === "production" ? err.message : err,
    );
    req.flash("error_msg", "Erro ao enviar tarefa");
    return res.redirect("/aluno/tarefas");
  }
};

exports.equipe = (req, res) => {
  res.render("dashboard/dashboardEquipe", {
    user: req.session.user,
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === "Admin",
  });
};

exports.apiDadosGrafico = async (req, res) => {
  try {
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

exports.apiRankingComparativo = async (req, res) => {
  try {
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

exports.apiNotificacoes = async (req, res) => {
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
    const id = req.params.id;
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
    const ConfiguracaoNotificacao = require("../models/ConfiguracaoNotificacao");
    if (req.session.aluno?.id) {
      let config = await ConfiguracaoNotificacao.findByAlunoId(
        req.session.aluno.id,
      );
      if (!config)
        config = await ConfiguracaoNotificacao.createOrUpdateForAluno(
          req.session.aluno.id,
          {},
        );
      return res.json(config);
    }
    if (req.session.userId) {
      let config = await ConfiguracaoNotificacao.findByUsuarioId(
        req.session.userId,
      );
      if (!config)
        config = await ConfiguracaoNotificacao.createOrUpdateForUsuario(
          req.session.userId,
          {},
        );
      return res.json(config);
    }
    return res.status(401).json({ error: "Não autorizado" });
  } catch (err) {
    console.error("Erro ao buscar configurações:", err.message);
    return res.status(500).json({ error: "Erro ao buscar configurações" });
  }
};

exports.saveConfiguracoesNotificacoes = async (req, res) => {
  try {
    const ConfiguracaoNotificacao = require("../models/ConfiguracaoNotificacao");
    const keys = [
      "notificacoes_ativas",
      "notificacoes_email",
      "notificacoes_tarefas",
      "notificacoes_avaliacoes",
      "notificacoes_competencias",
    ];
    const config = {};
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, key)) continue;
      const value = booleanValue(req.body[key]);
      if (value === null)
        return res
          .status(400)
          .json({ error: "Configuração de notificações inválida." });
      config[key] = value;
    }
    if (!Object.keys(config).length)
      return res
        .status(400)
        .json({ error: "Nenhuma configuração válida foi enviada." });
    const result = req.session.aluno?.id
      ? await ConfiguracaoNotificacao.createOrUpdateForAluno(
          req.session.aluno.id,
          config,
        )
      : req.session.userId
        ? await ConfiguracaoNotificacao.createOrUpdateForUsuario(
            req.session.userId,
            config,
          )
        : null;
    if (!result) return res.status(401).json({ error: "Não autorizado" });
    return res.json({ success: true, config: result });
  } catch (err) {
    console.error("Erro ao salvar configurações:", err.message);
    return res
      .status(500)
      .json({ error: "Erro interno ao processar a solicitação." });
  }
};

exports.uploadSingle = upload.single("arquivo");
