const db = require("../db");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const bcrypt = require('bcryptjs');

const crypto = require("crypto");
const { text, personName, password, integerId, numberInRange, ALLOWED_YEARS, randomPassword, normalizeToEmailName, generateStudentEmail } = require('../utils/validation');

exports.dashboard = async (req, res) => {
  try {
    const alunosResult = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'nota', ac.nota
                            )
                        )
                        FROM aluno_competencias ac
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.nome ASC
        `);
    const alunos = alunosResult.rows;
    const alunosComNivel = alunos.map((aluno) => {
      let mediaCompetencias = 0;
      if (aluno.competencias && aluno.competencias.length > 0) {
        const soma = aluno.competencias.reduce(
          (acc, comp) => acc + parseFloat(comp.nota),
          0,
        );
        mediaCompetencias = soma / aluno.competencias.length;
      }
      let nivel = "EM DESENVOLVIMENTO";
      if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
        nivel = "APTO";
      } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
        nivel = "INAPTO";
      }
      return {
        ...aluno,
        nivel: nivel,
        media_competencias: mediaCompetencias.toFixed(1),
      };
    });
    const rankingGeralResult = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);
    const rankingMedioResult = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%MÉDIO%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);
    const rankingFundamentalResult = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%FUNDAMENTAL%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);
    const rankingGeral = rankingGeralResult.rows.map((item) => ({
      ...item,
      media: parseFloat(item.media) || 0,
    }));
    const rankingMedio = rankingMedioResult.rows.map((item) => ({
      ...item,
      media: parseFloat(item.media) || 0,
    }));
    const rankingFundamental = rankingFundamentalResult.rows.map((item) => ({
      ...item,
      media: parseFloat(item.media) || 0,
    }));
    res.render("dashboard/dashboardMain", {
      user: req.session.user,
      alunos: alunosComNivel,
      rankingGeral: rankingGeral,
      rankingMedio: rankingMedio,
      rankingFundamental: rankingFundamental,
      userCargo: req.session.userCargo,
      isAdmin: req.session.userCargo === "Admin",
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao carregar dados do dashboard");
    res.render("dashboard/dashboardMain", {
      user: req.session.user,
      alunos: [],
      rankingGeral: [],
      rankingMedio: [],
      rankingFundamental: [],
    });
  }
};

exports.editAlunos = async (req, res) => {
  try {
    const result = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', nd.id,
                                'titulo', nd.titulo,
                                'descricao', nd.descricao,
                                'valor', nd.valor,
                                'data_criacao', nd.data_criacao
                            ) ORDER BY nd.id ASC
                        )
                        FROM notas_detalhadas nd
                        WHERE nd.aluno_id = a.id
                    ), 
                    '[]'::json
                ) as notas_individuais,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ac.id,
                                'competencia_id', ac.competencia_id,
                                'nome', c.nome,
                                'descricao', c.descricao,
                                'categoria', c.categoria,
                                'nota', ac.nota,
                                'observacoes', ac.observacoes,
                                'data_registro', ac.data_registro
                            ) ORDER BY ac.id ASC
                        )
                        FROM aluno_competencias ac
                        JOIN competencias c ON ac.competencia_id = c.id
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.id ASC
        `);
    const competenciasList = await db.query(`
            SELECT id, nome, descricao, categoria
            FROM competencias 
            ORDER BY id ASC
        `);
    res.render("dashboard/dashboardEdit", {
      alunos: result.rows,
      listaCompetencias: competenciasList.rows,
      user: req.session.user,
      userCargo: req.session.userCargo,
      isAdmin: req.session.userCargo === "Admin",
    });
  } catch (err) {
    console.error("ERRO NO DASHBOARD EDIT:", err);
    req.flash("error_msg", "Não foi possível carregar os dados");
    res.redirect("/dashboard");
  }
};

exports.graficos = async (req, res) => {
  try {
    const alunosResult = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'nota', ac.nota
                            )
                        )
                        FROM aluno_competencias ac
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
        `);
    const alunos = alunosResult.rows;
    let total = 0;
    let apto = 0;
    let inapto = 0;
    let somaMedio = 0;
    let countMedio = 0;
    let somaFundamental = 0;
    let countFundamental = 0;
    alunos.forEach((aluno) => {
      total++;
      let mediaCompetencias = 0;
      if (aluno.competencias && aluno.competencias.length > 0) {
        const soma = aluno.competencias.reduce(
          (acc, comp) => acc + parseFloat(comp.nota),
          0,
        );
        mediaCompetencias = soma / aluno.competencias.length;
      }
      if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
        apto++;
      } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
        inapto++;
      }
      if (aluno.ano_escolar.includes("MÉDIO")) {
        somaMedio += mediaCompetencias;
        countMedio++;
      } else if (aluno.ano_escolar.includes("FUNDAMENTAL")) {
        somaFundamental += mediaCompetencias;
        countFundamental++;
      }
    });
    const stats = {
      total: total,
      apto: apto,
      inapto: inapto,
      mediaMedio: countMedio > 0 ? (somaMedio / countMedio).toFixed(1) : 0,
      mediaFundamental:
        countFundamental > 0
          ? (somaFundamental / countFundamental).toFixed(1)
          : 0,
    };
    res.render("dashboard/dashboardGraficos", {
      stats,
      userCargo: req.session.userCargo,
      isAdmin: req.session.userCargo === "Admin",
      user: req.session.user,
    });
  } catch (err) {
  if (process.env.NODE_ENV !== "production") console.error(err);
    req.flash("error_msg", "Erro ao carregar gráficos");
    res.render("dashboard/dashboardGraficos", {
      stats: {
        total: 0,
        apto: 0,
        inapto: 0,
        mediaMedio: 0,
        mediaFundamental: 0,
      },
      user: req.session.user,
      userCargo: req.session.userCargo,
      isAdmin: req.session.userCargo === "Admin",
    });
  }
};

exports.equipe = (req, res) => {
  res.render("dashboard/dashboardEquipe");
};

exports.alterarSenha = async (req, res) => {
  const senha_atual = typeof req.body.senha_atual === 'string' ? req.body.senha_atual : '';
  const nova_senha = password(req.body.nova_senha);
  const confirmar_senha = typeof req.body.confirmar_senha === 'string' ? req.body.confirmar_senha : '';
  try {
    const result = await db.query("SELECT senha FROM usuarios WHERE id = $1", [
      req.session.userId,
    ]);
    if (result.rows.length === 0) {
      req.flash("error_msg", "Usuário não encontrado");
      return res.redirect("/dashboard?settings=account");
    }
    const user = result.rows[0];

    const senhaAtualValida = await bcrypt.compare(senha_atual, user.senha);
    if (!senhaAtualValida) {
      req.flash("error_msg", "Senha atual incorreta");
      return res.redirect("/dashboard?settings=account");
    }

    if (!nova_senha) {
      req.flash("error_msg", "A nova senha deve ter entre 12 e 128 caracteres");
      return res.redirect("/dashboard?settings=account");
    }
    if (nova_senha !== confirmar_senha) {
      req.flash("error_msg", "As senhas não coincidem");
      return res.redirect("/dashboard?settings=account");
    }

    const novaSenhaHash = await bcrypt.hash(nova_senha, 12);

    await db.query("UPDATE usuarios SET senha = $1 WHERE id = $2", [
      novaSenhaHash,
      req.session.userId,
    ]);

    const oldSessionData = {
      user: req.session.user,
      userStatus: req.session.userStatus,
      userId: req.session.userId,
      userCargo: req.session.userCargo
    };
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    Object.assign(req.session, oldSessionData);
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    req.flash("success_msg", "Senha alterada com sucesso!");
    res.redirect("/dashboard?settings=account");
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    req.flash("error_msg", "Erro ao alterar senha");
    res.redirect("/dashboard?settings=account");
  }
};

exports.alunoDados = async (req, res) => {
  try {
    const alunoId = integerId(req.params.id);
    if (!alunoId) return res.status(400).json({ error: 'ID de aluno inválido' });
    const result = await db.query(
      `
            SELECT 
                a.id,
                a.nome,
                a.presenca,
                al.email,
                al.matricula
            FROM alunos a
            LEFT JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `,
      [alunoId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Aluno não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar dados do aluno:", err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};

exports.gerarSenhaAluno = async (req, res) => {
  try {
    const alunoId = integerId(req.params.id);
    if (!alunoId) return res.status(400).json({ error: 'ID de aluno inválido' });

    const senha = randomPassword();
    const senhaHash = await bcrypt.hash(senha, 12);
    const result = await db.query(
      'UPDATE alunos_login SET senha = $1 WHERE aluno_id = $2 RETURNING email, matricula',
      [senhaHash, alunoId],
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Credenciais do aluno não encontradas' });
    res.json({ sucesso: true, email: result.rows[0].email, matricula: result.rows[0].matricula, senha });
  } catch (err) {
    console.error('Erro ao gerar senha do aluno:', err);
    res.status(500).json({ error: 'Erro ao gerar nova senha' });
  }
};

exports.competenciasAluno = async (req, res) => {
  const alunoId = integerId(req.params.id);
  if (!alunoId) return res.status(400).json({ error: 'ID de aluno inválido' });
  try {
    const result = await db.query(
      `
            SELECT 
                ac.*, 
                c.nome, 
                c.descricao as competencia_desc,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `,
      [alunoId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar competências:", error);
    res.status(500).json({ error: "Erro ao buscar competências" });
  }
};

exports.adicionarCompetencia = async (req, res) => {
  const aluno_id = integerId(req.body.aluno_id);
  const competencia_id = integerId(req.body.competencia_id);
  const nota = numberInRange(req.body.nota, 0, 10);
  const observacoes = text(req.body.observacoes, 2000) || null;
  if (!aluno_id || !competencia_id || nota === null) {
    req.flash(
      "error_msg",
      "Todos os campos obrigatórios devem ser preenchidos",
    );
    return res.redirect("/dashboard/edit");
  }
  if (nota === null) {
    req.flash("error_msg", "A nota deve estar entre 0 e 10");
    return res.redirect("/dashboard/edit");
  }
  try {
    await db.query(
      "INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)",
      [aluno_id, competencia_id, nota, observacoes || null],
    );
    const { criarNotificacao } = require("../utils/notificacao");
    await criarNotificacao(
      "competencia",
      null,
      aluno_id,
      "Nova Competência",
      `Uma nova competência foi registrada: ${nota}`,
      `/aluno/competencias`,
      "fas fa-trophy",
      "#217346",
    );
    req.flash("success_msg", "Competência adicionada com sucesso!");
    res.redirect("/dashboard/edit");
  } catch (error) {
    console.error("Erro ao adicionar competência:", error);
    req.flash("error_msg", "Erro ao adicionar competência");
    res.redirect("/dashboard/edit");
  }
};

exports.deletarCompetencia = async (req, res) => {
  const compId = integerId(req.params.id);
  if (!compId) {
    req.flash('error_msg', 'Competência inválida');
    return res.redirect('/dashboard/edit');
  }
  try {
    await db.query("DELETE FROM aluno_competencias WHERE id = $1", [compId]);
    req.flash("success_msg", "Competência removida com sucesso");
    res.redirect("/dashboard/edit");
  } catch (error) {
    console.error("Erro ao deletar competência:", error);
    req.flash("error_msg", "Erro ao deletar competência");
    res.redirect("/dashboard/edit");
  }
};

exports.atualizarPresenca = async (req, res) => {
  const aluno_id = integerId(req.body.aluno_id);
  const presenca = numberInRange(req.body.presenca, 0, 100);
  if (!aluno_id || presenca === null) {
    req.flash('error_msg', 'Dados de presença inválidos');
    return res.redirect('/dashboard/edit');
  }
  try {
    await db.query("UPDATE alunos SET presenca = $1 WHERE id = $2", [
      presenca,
      aluno_id,
    ]);
    req.flash("success_msg", "Presença atualizada com sucesso!");
    res.redirect("/dashboard/edit");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao atualizar presença");
    res.redirect("/dashboard/edit");
  }
};

exports.addAluno = async (req, res) => {
  const nome = personName(req.body.nome);
  const ano_escolar = ALLOWED_YEARS.includes(req.body.ano_escolar) ? req.body.ano_escolar : null;
  const idade = numberInRange(req.body.idade, 10, 20);
  if (!nome || !ano_escolar || idade === null) {
    req.flash("error_msg", "Todos os campos são obrigatórios");
    return res.redirect("/dashboard/edit");
  }
  try {
    const nomeLower = normalizeToEmailName(nome);
    const numeroAleatorio = crypto.randomInt(10, 100);
    const email = generateStudentEmail(nome);
    const senha = randomPassword();
    const senhaHash = await bcrypt.hash(senha, 12);
    
    const matricula = `alu${Date.now().toString().slice(-8)}`;
    const alunoResult = await db.query(
      `INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) 
             VALUES ($1, $2, $3, 0, 100, 'EM DESENVOLVIMENTO') RETURNING id`,
      [nome, ano_escolar, idade],
    );
    const alunoId = alunoResult.rows[0].id;
    await db.query(
      `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
             VALUES ($1, $2, $3, $4, $5, 'ATIVO')`,
      [nome, email, senhaHash, matricula, alunoId],
    );
    req.flash(
      "success_msg",
      `Aluno cadastrado com sucesso! Login: ${email} / Senha temporária: ${senha}`,
    );
    res.redirect("/dashboard/edit");
  } catch (err) {
    console.error("Erro ao adicionar aluno:", err);
    if (err.code === "23505") {
      if (err.constraint === "alunos_login_email_key") {
        const nomeLower = normalizeToEmailName(nome);
        const timestamp = Date.now().toString().slice(-6);
        const emailAlternativo = `${nomeLower}.${timestamp}@aluno.analisai.com`;
        req.flash(
          "error_msg",
          `Email já existente. Tente novamente ou use: ${emailAlternativo}`,
        );
      } else if (err.constraint === "alunos_login_matricula_key") {
        req.flash("error_msg", "Matrícula já existente. Tente novamente.");
      } else {
        req.flash(
          "error_msg",
          "Email ou matrícula já existente. Tente novamente.",
        );
      }
    } else {
      req.flash("error_msg", "Erro ao adicionar aluno");
    }
    res.redirect("/dashboard/edit");
  }
};

exports.deleteAluno = async (req, res) => {
  const id = integerId(req.params.id);
  if (!id) {
    req.flash('error_msg', 'Aluno inválido');
    return res.redirect('/dashboard/edit');
  }
  try {
    await db.query("DELETE FROM alunos WHERE id = $1", [id]);
    const checkEmpty = await db.query("SELECT COUNT(*) FROM alunos");
    if (parseInt(checkEmpty.rows[0].count) === 0) {
      await db.query("ALTER SEQUENCE alunos_id_seq RESTART WITH 1");
    } else {
      await db.query(
        "SELECT setval('alunos_id_seq', (SELECT MAX(id) FROM alunos))",
      );
    }
    req.flash("success_msg", "Aluno removido com sucesso!");
    res.redirect("/dashboard/edit");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao remover aluno");
    res.redirect("/dashboard/edit");
  }
};

exports.eraseAll = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    
    await client.query("TRUNCATE TABLE tarefas_alunos RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE tarefas RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE aluno_competencias RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE notas_detalhadas RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE alunos_login RESTART IDENTITY CASCADE");
    await client.query("TRUNCATE TABLE alunos RESTART IDENTITY CASCADE");

    await client.query("COMMIT");
    
    req.flash("success_msg", "Todos os dados foram apagados com sucesso!");
    res.redirect("/dashboard/edit");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao apagar os dados:", err);
    req.flash("error_msg", "Erro ao apagar os dados no banco de dados.");
    res.redirect("/dashboard/edit");
  } finally {
    client.release();
  }
};

exports.importarDados = async (req, res) => {
  try {
    const { alunos } = req.body;
    if (!alunos || !Array.isArray(alunos)) {
      return res.json({ sucesso: false, erro: "Dados inválidos" });
    }
    let importados = 0;
    let duplicados = 0;
    
    const credenciais = [];

    if (alunos.length > 500) return res.status(400).json({ sucesso: false, erro: 'Limite de 500 alunos por importação.' });
    for (const aluno of alunos) {
      const nome = personName(aluno.nome);
      const ano_escolar = ALLOWED_YEARS.includes(aluno.ano_escolar) ? aluno.ano_escolar : null;
      const idade = numberInRange(aluno.idade, 10, 20);
      const presenca = numberInRange(aluno.presenca ?? 100, 0, 100);
      if (!nome || !ano_escolar || idade === null || presenca === null) continue;
      const existe = await db.query("SELECT id FROM alunos WHERE nome = $1", [nome]);
      if (existe.rows.length > 0) {
        duplicados++;
        continue;
      }
      const result = await db.query(
        `INSERT INTO alunos (nome, ano_escolar, idade, presenca, nivel) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          nome,
          ano_escolar,
          idade,
          presenca,
          "EM DESENVOLVIMENTO",
        ],
      );
      const alunoId = result.rows[0].id;
      const nomeLower = normalizeToEmailName(nome);
      const numeroAleatorio = crypto.randomInt(10, 100);
      const email = generateStudentEmail(nome);
      const matricula = `ALU${Date.now().toString().slice(-8)}${importados}`;
      const senhaTemporaria = randomPassword();
      const senhaHash = await bcrypt.hash(senhaTemporaria, 12);
      credenciais.push({ nome, email, matricula, senha: senhaTemporaria });
      await db.query(
        `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
                 VALUES ($1, $2, $3, $4, $5, 'ATIVO')`,
        [nome, email, senhaHash, matricula, alunoId],
      );
      importados++;
    }
    res.json({
      sucesso: true,
      importados,
      duplicados,
      mensagem: `${importados} alunos importados com sucesso! ${duplicados} duplicados ignorados.`,
      credenciais,
    });
  } catch (err) {
    console.error("Erro na importação:", err);
    res.status(500).json({ sucesso: false, erro: 'Erro interno durante a importação.' });
  }
};

exports.importarDadosCompletos = async (req, res) => {
  try {
    const { alunos } = req.body;
    if (!alunos || !Array.isArray(alunos)) {
      return res.json({ sucesso: false, erro: "Dados inválidos" });
    }
    let importados = 0;
    let duplicados = 0;
    let totalCompetencias = 0;

    const credenciais = [];

    if (alunos.length > 500) return res.status(400).json({ sucesso: false, erro: 'Limite de 500 alunos por importação.' });
    for (const aluno of alunos) {
      const nome = personName(aluno.nome);
      const ano_escolar = ALLOWED_YEARS.includes(aluno.ano_escolar) ? aluno.ano_escolar : null;
      const idade = numberInRange(aluno.idade, 10, 20);
      const presenca = numberInRange(aluno.presenca ?? 100, 0, 100);
      if (!nome || !ano_escolar || idade === null || presenca === null) continue;
      const existe = await db.query("SELECT id FROM alunos WHERE nome = $1", [nome]);
      if (existe.rows.length > 0) {
        duplicados++;
        continue;
      }
      const result = await db.query(
        `INSERT INTO alunos (nome, ano_escolar, idade, presenca, nivel) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          nome,
          ano_escolar,
          idade,
          presenca,
          "EM DESENVOLVIMENTO",
        ],
      );
      const alunoId = result.rows[0].id;
      const nomeLower = normalizeToEmailName(nome);
      const numeroAleatorio = crypto.randomInt(10, 100);
      const email = generateStudentEmail(nome);
      const matricula = `ALU${Date.now().toString().slice(-8)}${importados}`;
      const senhaTemporaria = randomPassword();
      const senhaHash = await bcrypt.hash(senhaTemporaria, 12);
      credenciais.push({ nome, email, matricula, senha: senhaTemporaria });
      await db.query(
        `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
                 VALUES ($1, $2, $3, $4, $5, 'ATIVO')`,
        [nome, email, senhaHash, matricula, alunoId], 
      );
      importados++;
      if (aluno.competencias && aluno.competencias.length > 0) {
        for (const comp of aluno.competencias.slice(0, 50)) {
          const compNota = numberInRange(comp.nota, 0, 10);
          const compNome = text(comp.nome, 100, { min: 1 });
          if (compNota === null || !compNome) continue;
          const compResult = await db.query(
            "SELECT id FROM competencias WHERE nome = $1",
            [compNome],
          );
          if (compResult.rows.length > 0) {
            const competenciaId = compResult.rows[0].id;
            await db.query(
              "INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)",
              [alunoId, competenciaId, compNota, "Importado via planilha"],
            );
            totalCompetencias++;
          }
        }
      }
    }
    res.json({
      sucesso: true,
      importados,
      duplicados,
      totalCompetencias,
      mensagem: `${importados} alunos importados com ${totalCompetencias} competências! ${duplicados} duplicados ignorados.`,
      credenciais,
    });
  } catch (err) {
    console.error("Erro na importação:", err);
    res.status(500).json({ sucesso: false, erro: 'Erro interno durante a importação.' });
  }
};

exports.baixarModeloImportacao = async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Relatório AnalisAI");
    worksheet.columns = [
      { key: "A", width: 10 },
      { key: "B", width: 20 },
      { key: "C", width: 20 },
      { key: "D", width: 24 },
      { key: "E", width: 12 },
      { key: "F", width: 12 },
      { key: "G", width: 25 },
      { key: "H", width: 120 },
    ];
    try {
      const logoPath = path.join(
        process.cwd(),
        "public",
        "IMG",
        "xls-logo.png",
      );
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoId = workbook.addImage({
          buffer: logoBuffer,
          extension: "png",
        });
        worksheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          br: { col: 3, row: 6 },
        });
      }
    } catch (e) {
      console.log("Logo não encontrado", e);
    }
    worksheet.mergeCells("D2:G4");
    const titleCell = worksheet.getCell("D2");
    titleCell.value = "MODELO DE IMPORTAÇÃO - PREENCHA OS DADOS";
    titleCell.font = { size: 16, bold: true, color: { argb: "FFFF0101" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    const headerRow = worksheet.getRow(8);
    headerRow.values = [
      "ID",
      "ALUNO",
      "ANO ESCOLAR",
      "IDADE",
      "MÉDIA",
      "PRESENÇA",
      "NÍVEL",
      "COMPETÊNCIAS",
    ];
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0101" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    worksheet.addRow([
      "",
      "JOÃO SILVA",
      "1º MÉDIO",
      15,
      "",
      "90%",
      "",
      "Raciocínio Lógico: 8.5; Comunicação: 7.0",
    ]);
    worksheet.addRow([
      "",
      "MARIA OLIVEIRA",
      "2º MÉDIO",
      16,
      "",
      "85%",
      "",
      "Proatividade: 9.0; Organização: 6.5",
    ]);
    worksheet.addRow([
      "",
      "PEDRO SANTOS",
      "3º MÉDIO",
      17,
      "",
      "95%",
      "",
      "Liderança: 8.0; Trabalho em Equipe: 7.5",
    ]);
    worksheet.addRow([
      "",
      "ANA BEATRIZ",
      "9º FUNDAMENTAL",
      14,
      "",
      "100%",
      "",
      "Comunicação: 9.5; Criatividade: 8.0",
    ]);
    let currentRow = 8 + 5 + 2;
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = "INSTRUÇÕES DE PREENCHIMENTO:";
    titleRow.getCell(1).font = { bold: true, color: { argb: "FFFF0101" } };
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst1 = worksheet.getRow(currentRow);
    inst1.getCell(1).value =
      "1. ID: Deixe em branco (será gerado automaticamente)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst2 = worksheet.getRow(currentRow);
    inst2.getCell(1).value = "2. ALUNO: Nome completo (apenas letras)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst3 = worksheet.getRow(currentRow);
    inst3.getCell(1).value =
      "3. ANO ESCOLAR: Use 1º MÉDIO, 2º MÉDIO, 3º MÉDIO ou 9º FUNDAMENTAL";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst4 = worksheet.getRow(currentRow);
    inst4.getCell(1).value = "4. IDADE: Número entre 10 e 20";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst5 = worksheet.getRow(currentRow);
    inst5.getCell(1).value =
      "5. MÉDIA: Deixe em branco (calculada automaticamente)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst6 = worksheet.getRow(currentRow);
    inst6.getCell(1).value = "6. PRESENÇA: Número entre 0 e 100 (pode usar %)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst7 = worksheet.getRow(currentRow);
    inst7.getCell(1).value =
      "7. NÍVEL: Deixe em branco (calculado automaticamente)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst8 = worksheet.getRow(currentRow);
    inst8.getCell(1).value =
      '8. COMPETÊNCIAS: Formato "Competência: Nota; Competência: Nota"';
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=modelo_importacao_analisai.xlsx",
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerar modelo");
  }
};
