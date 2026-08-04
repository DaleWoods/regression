import { useEffect, useState } from 'react';
import { api, type Member } from '../api';

/** Entra ID SSO in every deployed environment; the email box is local dev only. */
export function LoginPage({ onSignedIn }: { onSignedIn: (member: Member) => void }) {
  const [mode, setMode] = useState<'entra' | 'dev' | null>(null);
  const [interimSignIn, setInterimSignIn] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .authMode()
      .then(({ mode, interimSignIn }) => {
        setMode(mode);
        setInterimSignIn(interimSignIn);
      })
      .catch(() => setMode('entra'));
  }, []);

  async function signIn(address: string) {
    setBusy(true);
    setError('');
    try {
      const { member } = await api.devLogin(address);
      onSignedIn(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <h1>Business Impact Scoring</h1>
        <p className="lede">Sign in with your Microsoft 365 account.</p>

        {mode === 'entra' || mode === null ? (
          <a className="button" href={`/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
            Sign in with Microsoft
          </a>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await signIn(email);
            }}
          >
            {interimSignIn ? (
              <div className="notice warn">
                <strong>Interim sign-in.</strong> Microsoft 365 single sign-on is not configured on this instance yet, so
                sign in with your committee email address for now.
              </div>
            ) : (
              <div className="notice">
                Local development mode. In deployed environments this is replaced by Entra ID single sign-on.
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Committee email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            {error ? (
              <p className="status error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
