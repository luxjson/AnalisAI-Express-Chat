const session = require('express-session');
const db = require('./db');

class PostgresSessionStore extends session.Store {
  constructor() {
    super();
    this.ready = db.query(`
      CREATE TABLE IF NOT EXISTS web_sessions (
        sid TEXT PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMPTZ NOT NULL
      )
    `);
    this.cleanup = setInterval(() => { db.query('DELETE FROM web_sessions WHERE expire <= CURRENT_TIMESTAMP').catch(() => {}); }, 60 * 60 * 1000).unref();
  }

  async get(sid, callback) {
    try {
      await this.ready;
      const result = await db.query('SELECT sess FROM web_sessions WHERE sid = $1 AND expire > CURRENT_TIMESTAMP', [sid]);
      callback(null, result.rows[0]?.sess || null);
    } catch (err) { callback(err); }
  }

  async set(sid, sess, callback) {
    try {
      await this.ready;
      const expire = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + (sess.cookie?.maxAge || 28_800_000));
      await db.query(`INSERT INTO web_sessions (sid, sess, expire) VALUES ($1, $2::jsonb, $3)
        ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`, [sid, JSON.stringify(sess), expire]);
      callback?.(null);
    } catch (err) { callback?.(err); }
  }

  async destroy(sid, callback) {
    try { await this.ready; await db.query('DELETE FROM web_sessions WHERE sid = $1', [sid]); callback?.(null); }
    catch (err) { callback?.(err); }
  }

  async touch(sid, sess, callback) {
    try {
      await this.ready;
      const expire = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + (sess.cookie?.maxAge || 28_800_000));
      await db.query('UPDATE web_sessions SET expire = $1 WHERE sid = $2', [expire, sid]);
      callback?.(null);
    } catch (err) { callback?.(err); }
  }

  async clear(callback) {
    try { await this.ready; await db.query('DELETE FROM web_sessions'); callback?.(null); }
    catch (err) { callback?.(err); }
  }

  async length(callback) {
    try { await this.ready; const r = await db.query('SELECT COUNT(*) FROM web_sessions WHERE expire > CURRENT_TIMESTAMP'); callback?.(null, Number(r.rows[0].count)); }
    catch (err) { callback?.(err); }
  }

  async all(callback) {
    try { await this.ready; const r = await db.query('SELECT sess FROM web_sessions WHERE expire > CURRENT_TIMESTAMP'); callback?.(null, r.rows.map(x => x.sess)); }
    catch (err) { callback?.(err); }
  }
}

module.exports = PostgresSessionStore;
