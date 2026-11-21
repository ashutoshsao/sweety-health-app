import { useState, type FormEvent } from "react";
import { api, type Session, type User } from "./api";

export default function AuthScreen({
  onSignedIn,
  message,
}: {
  onSignedIn: (session: Session) => void;
  message?: string;
}) {
  const [signingUp, setSigningUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (signingUp) {
        const { user } = await api<{ user: User }>("/auth/signup", {
          method: "POST",
          body: { name, email, password },
        });
        setEmail(user.email);
        setPassword("");
        setSigningUp(false);
        setNotice("Account created. Sign in to open your logbook.");
      } else {
        const session = await api<Session>("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        onSignedIn(session);
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    setSigningUp(!signingUp);
    setError("");
    setNotice("");
    setPassword("");
  }

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <span className="wordmark">
          Sweety<span aria-hidden="true">.</span>
        </span>
        <h1>{signingUp ? "Create your account" : "Sign in to your logbook"}</h1>
        {notice || message ? (
          <p className="notice" role="status">
            {notice || message}
          </p>
        ) : null}
        <form className="auth-form" onSubmit={submit}>
          {signingUp && (
            <label>
              Name
              <input
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {signingUp && (
            <p className="field-note">Use at least 8 characters.</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="text-button auth-switch"
          onClick={toggle}
          disabled={busy}
        >
          {signingUp ? "Back to sign in" : "Create an account"}
        </button>
      </div>
    </main>
  );
}
