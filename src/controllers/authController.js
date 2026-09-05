const db = require('../db');
const { criarNotificacao } = require('../utils/notificacao');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { email: normalizeEmail, text } = require('../utils/validation');

const BCRYPT_ROUNDS = 12;

async function renderLogin(req, res, tipo, error_msg = null, success_msg = null) {
    if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return res.render('login', { error_msg, success_msg, tipo, csrfToken: req.session.csrfToken });
}

exports.showHome = (req, res) => res.render('index');
exports.showTermos = (req, res) => res.render('termos');

exports.showManuais = (req, res) => res.render('manuais', {
    user: req.session.user,
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === 'Admin'
});

exports.showManualDeUso = (req, res) => res.render('manualDoProfessor', {
    user: req.session.user,
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === 'Admin'
});

exports.showManualDoAluno = (req, res) => res.render('manualDoAluno', {
    aluno: req.session.aluno || null,
    user: req.session.user,
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === 'Admin',
    csrfToken: req.session.csrfToken
});

exports.showLogin = (req, res) => {
    const tipo = req.query.tipo === 'aluno' ? 'aluno' : 'professor';
    return renderLogin(req, res, tipo, req.flash('error_msg'), req.flash('success_msg'));
};

exports.loginProfessor = async (req, res) => {
    const usuario = normalizeEmail(req.body.usuario);
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
    const tipo = 'professor';

    if (!usuario || !senha || senha.length > 128) {
        return renderLogin(req, res, tipo, 'E-mail ou senha inválidos.');
    }

    try {
        const result = await db.query(
            'SELECT id, nome, email, senha, cargo, status FROM usuarios WHERE email = $1',
            [usuario]
        );
        const user = result.rows[0];
        const senhaValida = user ? await bcrypt.compare(senha, user.senha) : false;
        if (!user || !senhaValida || user.status !== 'ATIVO') {
            return renderLogin(req, res, tipo, 'E-mail ou senha inválidos.');
        }

        await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
        req.session.user = user.nome;
        req.session.userStatus = user.status;
        req.session.userId = user.id;
        req.session.userCargo = user.cargo;
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

        await db.query(
            "UPDATE usuarios SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' WHERE id = $1",
            [user.id]
        );

        req.flash('success_msg', `Bem-vindo, ${user.nome}!`);
        await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
        return res.redirect('/dashboard');
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('Erro no login do professor:', err.message);
        return renderLogin(req, res, tipo, 'Não foi possível concluir o login. Tente novamente.');
    }
};

exports.loginAluno = async (req, res) => {
    const matricula = typeof req.body.matricula === 'string' ? req.body.matricula.trim().toUpperCase() : '';
    const email = normalizeEmail(req.body.email);
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
    const tipo = 'aluno';

    if ((!matricula && !email) || !senha || senha.length > 128) {
        return renderLogin(req, res, tipo, 'Informe credenciais válidas.');
    }

    try {
        const field = matricula ? 'matricula' : 'email';
        const value = matricula || email;
        const result = await db.query(
            `SELECT id, nome, email, senha, matricula, aluno_id, status FROM alunos_login WHERE ${field} = $1`,
            [value]
        );
        const aluno = result.rows[0];
        const senhaValida = aluno ? await bcrypt.compare(senha, aluno.senha) : false;

        if (!aluno || !senhaValida || aluno.status !== 'ATIVO') {
            return renderLogin(req, res, tipo, 'Credenciais inválidas.');
        }

        const alunoDados = await db.query(
            'SELECT id, nome, ano_escolar, presenca FROM alunos WHERE id = $1',
            [aluno.aluno_id]
        );
        if (alunoDados.rows.length === 0) return renderLogin(req, res, tipo, 'Não foi possível carregar os dados do aluno.');

        const dados = alunoDados.rows[0];
        await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
        req.session.aluno = {
            id: aluno.aluno_id,
            nome: aluno.nome,
            matricula: aluno.matricula,
            ano_escolar: dados.ano_escolar,
            login_id: aluno.id
        };
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

        await db.query(
            "UPDATE alunos_login SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' WHERE aluno_id = $1",
            [aluno.aluno_id]
        );

        req.flash('success_msg', `Bem-vindo, ${aluno.nome}!`);
        await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
        return res.redirect('/aluno');
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('Erro no login do aluno:', err.message);
        return renderLogin(req, res, tipo, 'Não foi possível concluir o login. Tente novamente.');
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => res.redirect('/'));
};

exports.showEsqueciSenha = (req, res) => res.render('esqueciSenha', {
    error_msg: req.flash('error_msg'),
    success_msg: req.flash('success_msg')
});

exports.solicitarRedefinicaoSenha = async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body.email);
    if (!normalizedEmail) {
        req.flash('error_msg', 'Informe um e-mail válido.');
        return res.render('esqueciSenha', { error_msg: req.flash('error_msg'), success_msg: null });
    }

    try {
        const result = await db.query('SELECT id, nome FROM usuarios WHERE email = $1', [normalizedEmail]);
        if (result.rows.length > 0) {
            const usuario = result.rows[0];
            const token = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
            await db.query(
                `INSERT INTO solicitacoes_senha (usuario_id, email, token, status) VALUES ($1, $2, $3, 'PENDENTE')`,
                [usuario.id, normalizedEmail, token]
            );
            const admins = await db.query('SELECT id FROM usuarios WHERE cargo = $1 AND status = $2', ['Admin', 'ATIVO']);
            for (const admin of admins.rows) {
                await criarNotificacao(
                    'solicitacao_senha', admin.id, null,
                    'Solicitação de Redefinição de Senha',
                    `${usuario.nome} solicitou redefinição de senha`,
                    '/dashboard/solicitacoes-senha',
                    'fas fa-key', '#ff0101'
                );
            }
        }
        req.flash('success_msg', 'Se o e-mail estiver cadastrado, a solicitação será analisada por um administrador.');
        return res.render('esqueciSenha', { error_msg: null, success_msg: req.flash('success_msg') });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('Erro ao solicitar recuperação:', err.message);
        req.flash('error_msg', 'Não foi possível processar a solicitação.');
        return res.render('esqueciSenha', { error_msg: req.flash('error_msg'), success_msg: null });
    }
};
