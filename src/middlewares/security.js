const crypto = require("crypto");
const db = require("../db");

function csrfSignature(token) {
  const secret = process.env.SESSION_SECRET || "development-only-csrf-secret";
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

function setCsrfCookie(req, res, token) {
  const value = `${token}.${csrfSignature(token)}`;
  const flags = [
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
    `Max-Age=${8 * 60 * 60}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ];
  res.append(
    "Set-Cookie",
    `analisai.csrf=${encodeURIComponent(value)}; ${flags.join("; ")}`,
  );
}

function readSignedCsrfCookie(req) {
  const raw = req
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("analisai.csrf="))
    ?.slice("analisai.csrf=".length);
  if (!raw) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch (_) {
    return null;
  }
  const dot = decoded.lastIndexOf(".");
  if (dot <= 0) return null;
  const token = decoded.slice(0, dot);
  const signature = decoded.slice(dot + 1);
  const expected = csrfSignature(token);
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  return token;
}

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

let rateLimitReady;
function ensureRateLimitTable() {
  if (!rateLimitReady) {
    rateLimitReady = db.query(`
      CREATE TABLE IF NOT EXISTS security_rate_limits (
        rate_key TEXT PRIMARY KEY,
        window_start TIMESTAMPTZ NOT NULL,
        request_count INTEGER NOT NULL CHECK (request_count >= 0)
      )
    `);
  }
  return rateLimitReady;
}

function rateLimit({
  windowMs,
  max,
  keyPrefix = "global",
  message = "Muitas tentativas. Tente novamente mais tarde.",
}) {
  if (
    !Number.isFinite(windowMs) ||
    windowMs <= 0 ||
    !Number.isInteger(max) ||
    max <= 0
  ) {
    throw new TypeError("Configuração de rate limit inválida.");
  }

  return async (req, res, next) => {
    const rawKey = `${keyPrefix}:${getClientIp(req)}`;
    const key = crypto.createHash("sha256").update(rawKey).digest("hex");
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowMs);

    try {
      await ensureRateLimitTable();
      const result = await db.query(
        `
        INSERT INTO security_rate_limits (rate_key, window_start, request_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (rate_key) DO UPDATE SET
          window_start = CASE
            WHEN security_rate_limits.window_start <= $3 THEN EXCLUDED.window_start
            ELSE security_rate_limits.window_start
          END,
          request_count = CASE
            WHEN security_rate_limits.window_start <= $3 THEN 1
            ELSE security_rate_limits.request_count + 1
          END
        RETURNING window_start, request_count
      `,
        [key, now, cutoff],
      );

      const entry = result.rows[0];
      const count = Number(entry.request_count);
      const resetAt = new Date(entry.window_start).getTime() + windowMs;
      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, max - count)));
      res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

      if (count > max) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
        );
        return res.status(429).json({ error: message });
      }

      if (Math.random() < 0.01) {
        db.query(
          "DELETE FROM security_rate_limits WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '24 hours'",
        ).catch(() => {});
      }
      return next();
    } catch (err) {
      console.error(
        "Falha no rate limiter persistente:",
        process.env.NODE_ENV === "production" ? err.message : err,
      );
      return res
        .status(503)
        .json({ error: "Serviço temporariamente indisponível." });
    }
  };
}
function sameOriginProtection(req, res, next) {
  const rotasIgnoradas = ["/aluno/tarefas"];
  if (rotasIgnoradas.some((rota) => req.path.startsWith(rota))) {
    return next();
  }

  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!unsafe) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");
  const configuredOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  const allowedOrigin =
    configuredOrigin || `${req.protocol}://${req.get("host")}`;

  if (origin && origin !== allowedOrigin)
    return res
      .status(403)
      .json({ error: "Origem da requisição não permitida." });
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== allowedOrigin)
        return res
          .status(403)
          .json({ error: "Origem da requisição não permitida." });
    } catch {
      return res.status(403).json({ error: "Referência inválida." });
    }
  }
  if (!origin && !referer && req.get("x-requested-with") !== "XMLHttpRequest")
    return res.status(403).json({ error: "Cabeçalhos de origem ausentes." });

  return csrfProtection(req, res, next);
}

function csrfProtection(req, res, next) {
  const expected = req.session?.csrfToken;
  const supplied = req.get("x-csrf-token") || req.body?._csrf;
  const cookieToken = readSignedCsrfCookie(req);
  const sessionMatch =
    expected &&
    supplied &&
    supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  const cookieMatch =
    cookieToken &&
    supplied &&
    cookieToken.length === supplied.length &&
    crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(supplied));
  if (!supplied || (!sessionMatch && !cookieMatch)) {
    return res.status(403).json({ error: "Token CSRF inválido." });
  }
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com https://unpkg.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self'; worker-src 'self' blob:",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  next();
}

function csrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function attachCsrfToken(req, res, next) {
  const existing = readSignedCsrfCookie(req);
  const token = existing || csrfToken();
  res.locals.csrfToken = token;
  if (!existing) setCsrfCookie(req, res, token);
  next();
}

module.exports = {
  rateLimit,
  sameOriginProtection,
  securityHeaders,
  attachCsrfToken,
  csrfProtection,
};
