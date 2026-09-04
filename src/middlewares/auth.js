function isProfessorSession(req) {
  return Boolean(req.session?.user && req.session?.userStatus === 'ATIVO' && req.session?.userId);
}

function isAlunoSession(req) {
  return Boolean(req.session?.aluno?.id);
}

function checkAuth(req, res, next) {
  if (isProfessorSession(req)) return next();
  req.session.destroy(() => res.redirect('/login'));
}

function checkAdmin(req, res, next) {
  if (isProfessorSession(req) && req.session.userCargo === 'Admin') return next();
  req.flash('error_msg', 'Acesso negado. Apenas administradores podem realizar esta ação.');
  return res.redirect('/dashboard');
}

function checkAlunoAuth(req, res, next) {
  if (isAlunoSession(req)) return next();
  return res.redirect('/login?tipo=aluno');
}

function checkAnyAuth(req, res, next) {
  if (isProfessorSession(req) || isAlunoSession(req)) return next();
  return res.status(401).json({ error: 'Não autorizado' });
}

module.exports = { checkAuth, checkAdmin, checkAlunoAuth, checkAnyAuth, isProfessorSession, isAlunoSession };
