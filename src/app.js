const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const path = require('path');
const db = require('./db');
const morgan = require('morgan');
const { securityHeaders, sameOriginProtection, attachCsrfToken } = require('./middlewares/security');
const { checkAnyAuth } = require('./middlewares/auth');
const { escapeJsonForHtml } = require('./utils/validation');
const PostgresSessionStore = require('./sessionStore');

const app = express();

const indexRoutes = require('./routes/index');
const professorRoutes = require('./routes/professor');
const alunoRoutes = require('./routes/aluno');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const flashMiddleware = require('./middlewares/flash');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.disable('x-powered-by');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(express.json({ limit: '2mb' }));
app.use(securityHeaders);

app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres em produção.');
  }
  if (!process.env.APP_ORIGIN) {
    throw new Error('APP_ORIGIN deve ser configurado em produção.');
  }
  try {
    const origin = new URL(process.env.APP_ORIGIN);
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error();
    }
  } catch {
    throw new Error('APP_ORIGIN deve ser uma origem HTTPS válida, por exemplo https://app.exemplo.com');
  }
}

app.use(session({
  store: process.env.NODE_ENV === 'production' ? new PostgresSessionStore() : undefined,
  name: process.env.NODE_ENV === 'production' ? '__Host-analisai.sid' : 'analisai.sid',
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: undefined
  }
}));
app.use(attachCsrfToken);
app.use((req, res, next) => { res.locals.safeJson = escapeJsonForHtml; next(); });
app.use(sameOriginProtection);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(flash());
app.use(flashMiddleware);
app.get('/uploads/:filename', checkAnyAuth, async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!filename || filename !== req.params.filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).send('Arquivo inválido');
    }
    const access = await db.query(
      `SELECT ta.aluno_id, t.criado_por
       FROM tarefas_alunos ta
       JOIN tarefas t ON t.id = ta.tarefa_id
       WHERE ta.resposta_arquivo = $1
       LIMIT 1`,
      [filename]
    );
    if (access.rows.length === 0) return res.status(404).send('Arquivo não encontrado');

    const row = access.rows[0];
    const isAluno = Boolean(req.session?.aluno);
    const isOwnerAluno = isAluno && row.aluno_id === req.session.aluno.id;
    const isProfessor = Boolean(req.session?.userId);
    const isTaskOwner = isProfessor && (row.criado_por === req.session.userId || req.session.userCargo === 'Admin');
    if (!isOwnerAluno && !isTaskOwner) return res.status(403).send('Acesso negado');

    const filePath = path.join(__dirname, 'uploads', filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
});

app.use('/', indexRoutes);
app.use('/', professorRoutes);
app.use('/', alunoRoutes);
app.use('/', adminRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    titulo: 'PÁGINA NÃO ENCONTRADA',
    mensagem: 'A página que você está procurando não existe.',
    erroDetalhe: null,
    user: req.session?.user,
    userCargo: req.session?.userCargo,
    isAdmin: req.session?.userCargo === 'Admin'
  });
});

app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  else console.error(err.message);
  if (err.code === '23514') {
    req.flash('error_msg', process.env.NODE_ENV === 'development' ? (err.detail || 'Erro de validação') : 'Dados inválidos.');
    return res.redirect('/dashboard');
  }
  return res.status(500).render('error', {
    titulo: 'ERRO NO SERVIDOR',
    mensagem: 'Ocorreu um erro interno no servidor.',
    erroDetalhe: null,
    user: req.session?.user,
    userCargo: req.session?.userCargo,
    isAdmin: req.session?.userCargo === 'Admin'
  });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));