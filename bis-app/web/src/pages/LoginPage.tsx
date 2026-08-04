import { useEffect, useState } from 'react';
import { api, type Member } from '../api';

/** Entra ID SSO in every deployed environment; the email box is local dev only. */
const DEMO_ACCOUNTS = [
  { email: 'nikita@example.com', label: 'Nikita — coordinator' },
  { email: 'matt@example.com', label: 'Matt — committee (UX)' },
  { email: 'leadership@example.com', label: 'Leadership — read-only viewer' },
];

export function LoginPage({ onSignedIn }: { onSignedIn: (member: Member) => void }) {
  const [mode, setMode] = useState<'entra' | 'dev' | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .authMode()
      .then(({ mode, demoMode }) => {
        setMode(mode);
        setDemoMode(demoMode);
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
            {demoMode ? (
              <>
                <div className="notice warn">
                  <strong>Demo instance.</strong> Sign-in is email-only and the data is sample data. The real deployment
                  uses Microsoft 365 single sign-on.
                </div>
                <p style={{ marginTop: 0 }}>Pick a role to explore:</p>
                <div className="row" style={{ marginBottom: '1rem', flexDirection: 'column', alignItems: 'stretch' }}>
                  {DEMO_ACCOUNTS.map((account) => (
                    <button key={account.email} type="button" className="secondary" disabled={busy} onClick={() => signIn(account.email)}>
                      {account.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="notice">
                Local development mode. In deployed environments this is replaced by Entra ID single sign-on.
              </div>
            )}
            <div className="field">
              <label htmlFor="email">{demoMode ? 'Or sign in as another committee member' : 'Committee email'}</label>
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
