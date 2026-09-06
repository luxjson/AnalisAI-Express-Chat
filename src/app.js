const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const morgan = require('morgan');
const { securityHeaders, sameOriginProtection, attachCsrfToken } = require('./middlewares/security');
const { checkAnyAuth } = require('./middlewares/auth');
const { escapeJsonForHtml } = require('./utils/validation');
const PostgresSessionStore = require('./sessionStore');
const fileStore = require('./fileStore');

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

app.use((req, res, next) => {
  req.setTimeout(60000, () => {
    res.status(503).json({ error: 'Tempo limite excedido.' });
  });
  next();
});

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
app.use(async (req, res, next) => { try { await db.ensureRuntimeSchema(); next(); } catch (err) { console.error('Falha na inicialização do schema:', err.message); res.status(503).send('Serviço temporariamente indisponível.'); } });
app.use((req, res, next) => { res.locals.safeJson = escapeJsonForHtml; next(); });
app.use(sameOriginProtection);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(flash());
app.use(flashMiddleware);
app.get('/uploads/:filename', checkAnyAuth, async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    if (filename.length > 255) return res.status(400).send('Arquivo inválido');
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

    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
        if (err && !res.headersSent) next(err);
      });
    }

    {
      const stored = await fileStore.get(filename);
      if (!stored) return res.status(404).send('Arquivo não encontrado');
      res.setHeader('Content-Type', stored.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', String(stored.size_bytes));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.end(stored.content);
    }

    return res.status(404).send('Arquivo não encontrado');
  } catch (err) {
    next(err);
  }
});

app.use('/', indexRoutes);
app.use('/', professorRoutes);
app.use('/', alunoRoutes);
app.use('/', adminRoutes);
app.get('/api/internal/backup', async (req, res, next) => {
  try {
    const configured = process.env.CRON_SECRET;
    const authorization = req.get('authorization') || '';
    if (!configured || authorization !== `Bearer ${configured}`) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
    const backupService = require('./services/backupService');
    const backup = await backupService.checkAndRunScheduledBackup();
    return res.json({ ok: true, created: Boolean(backup), backup });
  } catch (err) {
    next(err);
  }
});

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
  if (res.headersSent) return next(err);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack || err);
  else console.error(err.message);

  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : 413;
    const message = err?.code === 'LIMIT_FILE_SIZE' ? 'O arquivo excede o limite permitido de 10 MB.' : 'A requisição excede o tamanho permitido.';
    if (req.accepts('html')) { req.flash('error_msg', message); return res.status(status).redirect(req.get('referer') || '/'); }
    return res.status(status).json({ error: message });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo da requisição inválido.' });
  }

  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'O arquivo excede o limite permitido de 10 MB.'
      : 'Arquivo inválido ou tipo de arquivo não permitido.';
    if (req.accepts('html')) {
      req.flash('error_msg', message);
      return res.redirect(req.get('referer') || '/aluno/tarefas');
    }
    return res.status(status).json({ error: message });
  }

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

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    try {
      const backupService = require('./services/backupService');
      backupService.init();
    } catch (err) {
      console.error('Falha ao inicializar o serviço de backup:', err.message);
    }
  });
}

module.exports = app;