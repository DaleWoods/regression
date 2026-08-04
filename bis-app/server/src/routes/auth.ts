import { Router } from 'express';
import { env } from '../config/env.js';
import { getDb } from '../db/index.js';
import { audit } from '../services/auditService.js';
import { getMemberByEmail, recordLogin, saveMember } from '../services/memberService.js';
import { AuthRequestState, buildAuthorizeUrl, createAuthRequestState, exchangeCode, logoutUrl } from '../auth/entra.js';
import { clearSession, issueSession } from '../auth/session.js';

const router = Router();
const STATE_COOKIE = 'bis_auth_state';

router.get('/mode', (_req, res) => {
  res.json({ mode: env.auth.mode, tenantConfigured: Boolean(env.auth.entra.tenantId && env.auth.entra.clientId) });
});

/** Entra ID SSO - no separate login (§4). */
router.get('/login', async (req, res) => {
  if (env.auth.mode !== 'entra') {
    res.status(400).json({ error: 'Entra sign-in is not enabled (AUTH_MODE=dev)' });
    return;
  }
  try {
    const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/';
    const state = createAuthRequestState(returnTo);
    res.cookie(STATE_COOKIE, JSON.stringify(state), {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.auth.cookieSecure,
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    res.redirect(await buildAuthorizeUrl(state));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const raw = req.cookies?.[STATE_COOKIE];
    if (!raw) throw new Error('Sign-in state missing or expired');
    const state = JSON.parse(raw) as AuthRequestState;
    if (req.query.state !== state.state) throw new Error('Sign-in state mismatch');
    if (typeof req.query.code !== 'string') throw new Error(`Entra returned no code: ${String(req.query.error ?? '')}`);

    const identity = await exchangeCode(req.query.code, state);
    const db = await getDb();

    // Members are provisioned by the coordinator; unknown users are not
    // silently admitted (§4 RBAC).
    const member = await getMemberByEmail(db, identity.email);
    if (!member || !member.active) {
      res.status(403).send(
        `<p>${identity.email} is not on the scoring committee. Ask the coordinator to add you.</p>`,
      );
      return;
    }

    await recordLogin(db, member.id, identity.oid);
    await issueSession(res, { memberId: member.id, email: member.email, name: member.name, role: member.role });
    await audit(db, { id: member.id, email: member.email }, 'auth.login', 'member', member.id, { method: 'entra' });

    res.clearCookie(STATE_COOKIE, { path: '/' });
    const target = state.returnTo?.startsWith('/') ? state.returnTo : '/';
    res.redirect(`${env.publicWebOrigin.replace(/\/+$/, '')}${target}`);
  } catch (err) {
    res.status(401).send(`<p>Sign-in failed: ${err instanceof Error ? err.message : 'unknown error'}</p>`);
  }
});

/**
 * Local development sign-in. Refused unless AUTH_MODE=dev, and production boot
 * refuses AUTH_MODE=dev outright (see assertProductionSafety).
 */
router.post('/dev-login', async (req, res) => {
  if (env.auth.mode !== 'dev') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const email = String(req.body?.email ?? '').trim();
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const db = await getDb();
  let member = await getMemberByEmail(db, email);
  if (!member && String(req.body?.create) === 'true') {
    member = await saveMember(db, { name: String(req.body?.name ?? email), email, role: 'COMMITTEE' });
  }
  if (!member || !member.active) {
    res.status(403).json({ error: 'No active committee member with that email' });
    return;
  }

  await recordLogin(db, member.id);
  await issueSession(res, { memberId: member.id, email: member.email, name: member.name, role: member.role });
  await audit(db, { id: member.id, email: member.email }, 'auth.login', 'member', member.id, { method: 'dev' });
  res.json({ member });
});

router.post('/logout', async (req, res) => {
  if (req.member) {
    const db = await getDb();
    await audit(db, { id: req.member.id, email: req.member.email }, 'auth.logout', 'member', req.member.id, {});
  }
  clearSession(res);
  const signOut = env.auth.mode === 'entra' ? await logoutUrl(env.publicWebOrigin) : null;
  res.json({ ok: true, signOutUrl: signOut });
});

export default router;
