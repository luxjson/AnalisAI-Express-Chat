const crypto = require('crypto');

const buckets = new Map();
const MAX_RATE_LIMIT_BUCKETS = 10000;

function csrfSignature(token) {
  const secret = process.env.SESSION_SECRET || 'development-only-csrf-secret';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function setCsrfCookie(req, res, token) {
  const value = `${token}.${csrfSignature(token)}`;
  const flags = [
    'Path=/',
    'SameSite=Lax',
    'HttpOnly',
    `Max-Age=${8 * 60 * 60}`,
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])
  ];
  res.append('Set-Cookie', `analisai.csrf=${encodeURIComponent(value)}; ${flags.join('; ')}`);
}

function readSignedCsrfCookie(req) {
  const raw = req.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('analisai.csrf='))?.slice('analisai.csrf='.length);
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  const dot = decoded.lastIndexOf('.');
  if (dot <= 0) return null;
  const token = decoded.slice(0, dot);
  const signature = decoded.slice(dot + 1);
  const expected = csrfSignature(token);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return token;
}

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function rateLimit({ windowMs, max, keyPrefix = 'global', message = 'Muitas tentativas. Tente novamente mais tarde.' }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now - entry.startedAt >= windowMs) {
      entry = { startedAt: now, count: 0 };
      if (buckets.size >= MAX_RATE_LIMIT_BUCKETS) cleanupRateLimitBuckets();
      if (buckets.size < MAX_RATE_LIMIT_BUCKETS) buckets.set(key, entry);
    }

    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil((entry.startedAt + windowMs) / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}
function sameOriginProtection(req, res, next) {
  const rotasIgnoradas = ['/aluno/tarefas'];
  if (rotasIgnoradas.some(rota => req.path.startsWith(rota))) {
    return next();
  }

  const unsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!unsafe) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  const configuredOrigin = process.env.APP_ORIGIN?.replace(/\/$/, '');
  const allowedOrigin = configuredOrigin || `${req.protocol}://${req.get('host')}`;

  if (origin && origin !== allowedOrigin) return res.status(403).json({ error: 'Origem da requisição não permitida.' });
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== allowedOrigin) return res.status(403).json({ error: 'Origem da requisição não permitida.' });
    } catch { return res.status(403).json({ error: 'Referência inválida.' }); }
  }
  if (!origin && !referer && req.get('x-requested-with') !== 'XMLHttpRequest') return res.status(403).json({ error: 'Cabeçalhos de origem ausentes.' });

  return csrfProtection(req, res, next);
}

function csrfProtection(req, res, next) {
  const expected = req.session?.csrfToken;
  const supplied = req.get('x-csrf-token') || req.body?._csrf;
  const cookieToken = readSignedCsrfCookie(req);
  const sessionMatch = expected && supplied && supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  const cookieMatch = cookieToken && supplied && cookieToken.length === supplied.length && crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(supplied));
  if (!supplied || (!sessionMatch && !cookieMatch)) {
    return res.status(403).json({ error: 'Token CSRF inválido.' });
  }
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com https://unpkg.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self'; worker-src 'self' blob:");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

function csrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function attachCsrfToken(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = csrfToken();
  res.locals.csrfToken = req.session.csrfToken;
  setCsrfCookie(req, res, req.session.csrfToken);
  next();
}

function cleanupRateLimitBuckets() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, value] of buckets) {
    if (value.startedAt < cutoff) buckets.delete(key);
  }
}

setInterval(cleanupRateLimitBuckets, 10 * 60 * 1000).unref();

module.exports = {
  rateLimit,
  sameOriginProtection,
  securityHeaders,
  attachCsrfToken,
  csrfProtection
};
