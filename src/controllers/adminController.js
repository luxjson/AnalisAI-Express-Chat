const db = require("../db");
const { criarNotificacao } = require("../utils/notificacao");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  text,
  email,
  password,
  integerId,
  ALLOWED_CARGOS,
  ALLOWED_STATUS,
} = require("../utils/validation");
const checkupService = require("../services/checkupService");
const backupService = require("../services/backupService");

function checkupUnlocked(req) {
  const at = Number(req.session?.adminCheckupUnlockedAt || 0);
  return (
    req.session?.adminCheckupUnlocked === true &&
    Number.isFinite(at) &&
    Date.now() - at <= 10 * 60 * 1000
  );
}

exports.listarUsuarios = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nome, email, cargo, status FROM usuarios ORDER BY nome ASC",
    );
    const isAdmin = req.session.userCargo === "Admin";
    const userCargo = req.session.userCargo;
    const userId = req.session.userId;
    const user = req.session.user;
    res.render("dashboard/dashboardUsuarios", {
      usuarios: result.rows,
      isAdmin: isAdmin,
      userCargo: userCargo,
      userId: userId,
      user: user,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao carregar usuários");
    res.redirect("/dashboard");
  }
};

exports.adicionarUsuario = async (req, res) => {
  const nome = text(req.body.nome, 100, { min: 2 });
  const userEmail = email(req.body.email);
  const senha = password(req.body.senha);
  const cargo = ALLOWED_CARGOS.includes(req.body.cargo) ? req.body.cargo : null;

  if (!nome) {
    req.flash("error_msg", "Nome inválido (mínimo 2 caracteres).");
    return res.redirect("/dashboard/usuarios");
  }
  if (!userEmail) {
    req.flash("error_msg", "E-mail inválido.");
    return res.redirect("/dashboard/usuarios");
  }
  if (!senha) {
    req.flash("error_msg", "Senha deve ter entre 12 e 128 caracteres.");
    return res.redirect("/dashboard/usuarios");
  }
  if (!cargo) {
    req.flash("error_msg", "Cargo inválido.");
    return res.redirect("/dashboard/usuarios");
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 12);
    await db.query(
      "INSERT INTO usuarios (nome, email, senha, cargo, status) VALUES ($1, $2, $3, $4, $5)",
      [nome, userEmail, senhaHash, cargo, "ATIVO"],
    );
    req.flash("success_msg", "Usuário cadastrado com sucesso!");
    res.redirect("/dashboard/usuarios");
  } catch (err) {
    req.flash("error_msg", "Erro ao cadastrar usuário");
    res.redirect("/dashboard/usuarios");
  }
};

exports.atualizarUsuario = async (req, res) => {
  const id = integerId(req.body.id);
  const nome = text(req.body.nome, 100, { min: 2 });
  const userEmail = email(req.body.email);
  const cargo = ALLOWED_CARGOS.includes(req.body.cargo) ? req.body.cargo : null;
  const status = ALLOWED_STATUS.includes(req.body.status)
    ? req.body.status
    : null;

  if (!id) {
    req.flash("error_msg", "ID de usuário inválido.");
    return res.redirect("/dashboard/usuarios");
  }
  if (!nome) {
    req.flash("error_msg", "Nome inválido (mínimo 2 caracteres).");
    return res.redirect("/dashboard/usuarios");
  }
  if (!userEmail) {
    req.flash("error_msg", "E-mail inválido.");
    return res.redirect("/dashboard/usuarios");
  }
  if (!cargo) {
    req.flash("error_msg", "Cargo inválido.");
    return res.redirect("/dashboard/usuarios");
  }
  if (!status) {
    req.flash("error_msg", "Status inválido.");
    return res.redirect("/dashboard/usuarios");
  }

  if (id === req.session.userId && (status !== "ATIVO" || cargo !== "Admin")) {
    req.flash(
      "error_msg",
      "Você não pode desativar ou remover seu próprio acesso de administrador.",
    );
    return res.redirect("/dashboard/usuarios");
  }
  try {
    const current = await db.query(
      "SELECT cargo, status FROM usuarios WHERE id = $1",
      [id],
    );
    if (current.rows.length === 0) {
      req.flash("error_msg", "Usuário não encontrado.");
      return res.redirect("/dashboard/usuarios");
    }
    const roleChanged =
      current.rows[0].cargo !== cargo || current.rows[0].status !== status;
    await db.query(
      "UPDATE usuarios SET nome=$1, email=$2, cargo=$3, status=$4 WHERE id=$5",
      [nome, userEmail, cargo, status, id],
    );
    if (process.env.NODE_ENV === "production" && roleChanged) {
      await db.query(`DELETE FROM web_sessions WHERE sess->>'userId' = $1`, [
        String(id),
      ]);
    }
    req.flash("success_msg", "Usuário atualizado com sucesso!");
    res.redirect("/dashboard/usuarios");
  } catch (err) {
    req.flash("error_msg", "Erro ao atualizar usuário");
    res.redirect("/dashboard/usuarios");
  }
};

exports.deletarUsuario = async (req, res) => {
  const id = integerId(req.params.id);
  if (!id || id === req.session.userId) {
    req.flash("error_msg", "Usuário inválido ou ação não permitida.");
    return res.redirect("/dashboard/usuarios");
  }
  const client = await db.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;
    const target = await client.query(
      "SELECT id, cargo, status FROM usuarios WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!target.rows.length) {
      await client.query("ROLLBACK");
      inTransaction = false;
      req.flash("error_msg", "Usuário não encontrado.");
      return res.redirect("/dashboard/usuarios");
    }
    if (target.rows[0].cargo === "Admin" && target.rows[0].status === "ATIVO") {
      const admins = await client.query(
        "SELECT COUNT(*) FROM usuarios WHERE cargo = 'Admin' AND status = 'ATIVO'",
      );
      if (Number(admins.rows[0].count) <= 1) {
        await client.query("ROLLBACK");
        inTransaction = false;
        req.flash(
          "error_msg",
          "O último administrador ativo não pode ser removido.",
        );
        return res.redirect("/dashboard/usuarios");
      }
    }
    await client.query("DELETE FROM web_sessions WHERE sess->>'userId' = $1", [
      String(id),
    ]);
    await client.query("DELETE FROM usuarios WHERE id = $1", [id]);
    await client.query("COMMIT");
    inTransaction = false;
    req.flash("success_msg", "Usuário removido com sucesso!");
    return res.redirect("/dashboard/usuarios");
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
    }
    console.error("Erro ao excluir usuário:", err);
    req.flash("error_msg", "Erro ao excluir usuário.");
    return res.redirect("/dashboard/usuarios");
  } finally {
    client.release();
  }
};

exports.listarSolicitacoesSenha = async (req, res) => {
  try {
    const result = await db.query(`
            SELECT 
                s.*,
                u.nome
            FROM solicitacoes_senha s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.status = 'PENDENTE'
            ORDER BY s.data_solicitacao DESC
        `);
    res.render("dashboard/dashboardSolicitacoes", {
      solicitacoes: result.rows,
      user: req.session.user,
      userCargo: req.session.userCargo,
      isAdmin: req.session.userCargo === "Admin",
    });
  } catch (err) {
    console.error("Erro ao carregar solicitações:", err);
    req.flash("error_msg", "Erro ao carregar solicitações");
    res.redirect("/dashboard");
  }
};

exports.aprovarSolicitacaoSenha = async (req, res) => {
  const novaSenha = password(req.body?.nova_senha);
  const solicitacaoId = integerId(req.params.id);
  if (!solicitacaoId || !novaSenha) {
    req.flash("error_msg", "A nova senha deve ter entre 12 e 128 caracteres.");
    return res.redirect("/dashboard/solicitacoes-senha");
  }

  const client = await db.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;
    const solicitacao = await client.query(
      "SELECT id, usuario_id FROM solicitacoes_senha WHERE id = $1 AND status = $2 FOR UPDATE",
      [solicitacaoId, "PENDENTE"],
    );
    if (!solicitacao.rows.length) {
      await client.query("ROLLBACK");
      inTransaction = false;
      req.flash("error_msg", "Solicitação não encontrada ou já processada.");
      return res.redirect("/dashboard/solicitacoes-senha");
    }

    const request = solicitacao.rows[0];
    const userLock = await client.query(
      "SELECT id FROM usuarios WHERE id = $1 FOR UPDATE",
      [request.usuario_id],
    );
    if (!userLock.rows.length) {
      await client.query("ROLLBACK");
      inTransaction = false;
      req.flash("error_msg", "Usuário não encontrado.");
      return res.redirect("/dashboard/solicitacoes-senha");
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);
    await client.query("UPDATE usuarios SET senha = $1 WHERE id = $2", [
      novaSenhaHash,
      request.usuario_id,
    ]);
    await client.query(`DELETE FROM web_sessions WHERE sess->>'userId' = $1`, [
      String(request.usuario_id),
    ]);
    await client.query(
      `UPDATE solicitacoes_senha SET status = 'APROVADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 WHERE id = $2`,
      [req.session.userId, solicitacaoId],
    );
    await client.query("COMMIT");
    inTransaction = false;

    try {
      await criarNotificacao(
        "senha_alterada",
        request.usuario_id,
        null,
        "Senha Redefinida",
        "Sua senha foi redefinida por um administrador",
        "/login",
        "fas fa-check-circle",
        "#217346",
      );
    } catch (notificationError) {
      console.error(
        "Erro ao criar notificação de senha redefinida:",
        notificationError.message,
      );
    }
    req.flash("success_msg", "Senha redefinida com sucesso!");
    return res.redirect("/dashboard/solicitacoes-senha");
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
    }
    console.error("Erro ao aprovar solicitação:", err);
    req.flash("error_msg", "Erro ao aprovar solicitação.");
    return res.redirect("/dashboard/solicitacoes-senha");
  } finally {
    client.release();
  }
};

exports.rejeitarSolicitacaoSenha = async (req, res) => {
  const { motivo } = req.body;
  const solicitacaoId = integerId(req.params.id);
  const safeMotivo = text(req.body.motivo, 500) || null;
  if (!solicitacaoId) {
    req.flash("error_msg", "Solicitação inválida.");
    return res.redirect("/dashboard/solicitacoes-senha");
  }
  try {
    const solicitacao = await db.query(
      "SELECT * FROM solicitacoes_senha WHERE id = $1 AND status = $2",
      [solicitacaoId, "PENDENTE"],
    );
    if (solicitacao.rows.length === 0) {
      req.flash("error_msg", "Solicitação não encontrada");
      return res.redirect("/dashboard/solicitacoes-senha");
    }
    const s = solicitacao.rows[0];
    await db.query(
      `UPDATE solicitacoes_senha 
             SET status = 'REJEITADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 
             WHERE id = $2`,
      [req.session.userId, solicitacaoId],
    );
    await criarNotificacao(
      "solicitacao_rejeitada",
      s.usuario_id,
      null,
      "Solicitação de Senha Rejeitada",
      safeMotivo || "Sua solicitação foi rejeitada. Contate o administrador.",
      `/login`,
      "fas fa-times-circle",
      "#ff0101",
    );
    req.flash("success_msg", "Solicitação rejeitada");
    res.redirect("/dashboard/solicitacoes-senha");
  } catch (err) {
    console.error("Erro ao rejeitar solicitação:", err);
    req.flash("error_msg", "Erro ao rejeitar solicitação");
    res.redirect("/dashboard/solicitacoes-senha");
  }
};

exports.verifyDeletePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        valid: false,
        message: "Senha não fornecida.",
      });
    }
    const expectedPassword = process.env.PASS_DELETE;
    if (!expectedPassword) {
      console.error("PASS_DELETE não está configurado no .env");
      return res.status(500).json({
        valid: false,
        message: "Erro de configuração do servidor.",
      });
    }
    const hashProvided = crypto.createHash("sha256").update(password).digest();
    const hashExpected = crypto
      .createHash("sha256")
      .update(expectedPassword)
      .digest();
    const isMatch = crypto.timingSafeEqual(hashProvided, hashExpected);

    if (isMatch) {
      req.session.adminCheckupUnlocked = true;
      req.session.adminCheckupUnlockedAt = Date.now();
      await new Promise((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve())),
      );
      return res.json({ valid: true });
    } else {
      return res.status(401).json({
        valid: false,
        message: "Senha administrativa incorreta.",
      });
    }
  } catch (err) {
    console.error("Erro ao verificar senha administrativa:", err);
    return res.status(500).json({
      valid: false,
      message: "Erro interno ao verificar senha.",
    });
  }
};

exports.runCheckup = async (req, res) => {
  try {
    if (!checkupUnlocked(req)) {
      return res
        .status(403)
        .json({
          error: "Acesso bloqueado. Confirme a senha administrativa primeiro.",
        });
    }
    const diagnostic = await checkupService.runSystemCheckup();
    const backupStatus = await backupService.getBackupStatus();
    res.json({
      ...diagnostic,
      backupStatus,
    });
  } catch (err) {
    console.error("Erro ao executar diagnóstico do sistema:", err);
    res
      .status(500)
      .json({ error: "Falha ao executar o diagnóstico das tabelas." });
  }
};

exports.executeRepair = async (req, res) => {
  try {
    if (!checkupUnlocked(req)) {
      return res
        .status(403)
        .json({
          error: "Acesso bloqueado. Confirme a senha administrativa primeiro.",
        });
    }
    const targetTable = req.body.table || "all";
    const result = await checkupService.repairSystem(targetTable);
    res.json(result);
  } catch (err) {
    console.error("Erro ao executar reparo no banco de dados:", err);
    if (err.code === "INVALID_TARGET_TABLE")
      return res.status(400).json({ error: "Tabela de reparo inválida." });
    res
      .status(500)
      .json({ error: "Falha ao executar o procedimento de correção." });
  }
};

exports.getBackupInfo = async (req, res) => {
  try {
    if (!checkupUnlocked(req)) {
      return res.status(403).json({ error: "Acesso não autorizado." });
    }
    const info = await backupService.getBackupStatus();
    res.json(info);
  } catch (err) {
    console.error("Erro ao consultar backup:", err);
    res.status(500).json({ error: "Erro ao consultar status de backup." });
  }
};

exports.triggerBackup = async (req, res) => {
  try {
    if (!checkupUnlocked(req)) {
      return res.status(403).json({ error: "Acesso não autorizado." });
    }
    const backup = await backupService.createBackup("manual-admin");
    const status = await backupService.getBackupStatus();
    res.json({
      success: true,
      backup,
      status,
    });
  } catch (err) {
    console.error("Erro ao gerar backup sob demanda:", err);
    res.status(500).json({ error: "Falha ao gerar o arquivo de backup." });
  }
};

exports.downloadBackupFile = async (req, res) => {
  try {
    if (!checkupUnlocked(req)) {
      return res.status(403).send("Acesso negado.");
    }
    const filename = req.params.filename;
    const content = await backupService.getBackupFile(filename);
    if (!content)
      return res.status(404).send("Arquivo de backup não encontrado.");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(content);
  } catch (err) {
    console.error("Erro no download do backup:", err);
    res.status(500).send("Erro ao baixar snapshot.");
  }
};
