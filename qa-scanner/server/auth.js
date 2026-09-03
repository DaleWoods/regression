// Shared-password (or optional per-user) login wall with signed cookies.
// No external auth service — everything is self-contained.
import crypto from 'node:crypto';
import { config } from '../src/config.js';

const SESSION_DAYS = 30;
const COOKIE = 'qa_session';

const secret =
  config.sessionSecret ||
  crypto.createHash('sha256').update(`qa-scanner:${config.password}`).digest('hex');

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkCredentials(username, password) {
  if (config.users.length > 0) {
    const user = config.users.find((u) => u.username === username);
    return user && safeEqual(password, user.password) ? user.username : null;
  }
  return safeEqual(password, config.password) ? username || 'shared' : null;
}

export function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, t: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() - data.t > SESSION_DAYS * 24 * 3600 * 1000) return null;
    return data.u;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function setSessionCookie(res, user) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(makeToken(user))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${
      SESSION_DAYS * 24 * 3600
    }`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export function authMiddleware(req, res, next) {
  if (config.authDisabled) return next();
  const user = verifyToken(parseCookies(req)[COOKIE]);
  if (user) {
    req.user = user;
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  return res.redirect('/login.html');
}
