import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Session, type User } from "./api";
import AuthScreen from "./AuthScreen";
import Logbook from "./Logbook";

const sessionKey = "sweety-token";

export default function App() {
  const [savedToken, setSavedToken] = useState(() =>
    sessionStorage.getItem(sessionKey),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const signOut = useCallback((message = "") => {
    sessionStorage.removeItem(sessionKey);
    setSavedToken(null);
    setSession(null);
    setNotice(message);
    setRestoreError("");
  }, []);

  const expire = useCallback(
    () => signOut("Your session has ended. Sign in again."),
    [signOut],
  );

  useEffect(() => {
    if (!savedToken || session) return;
    const controller = new AbortController();
    api<{ user: User }>("/auth/me", {
      token: savedToken,
      signal: controller.signal,
    })
      .then(({ user }) => {
        if (!controller.signal.aborted) setSession({ token: savedToken, user });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) expire();
        else setRestoreError(error.message);
      });
    return () => controller.abort();
  }, [savedToken, session, attempt, expire]);

  function signedIn(next: Session) {
    sessionStorage.setItem(sessionKey, next.token);
    setNotice("");
    setSession(next);
    setSavedToken(next.token);
  }

  if (session)
    return (
      <Logbook
        key={session.user.id}
        session={session}
        onSignOut={() => signOut()}
        onExpired={expire}
      />
    );
  if (!savedToken) return <AuthScreen onSignedIn={signedIn} message={notice} />;

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <span className="wordmark">
          Sweety<span aria-hidden="true">.</span>
        </span>
        <h1>Opening your logbook</h1>
        {restoreError ? (
          <>
            <p className="error" role="alert">
              {restoreError}
            </p>
            <button
              className="button primary"
              onClick={() => {
                setRestoreError("");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
            <button
              className="text-button auth-switch"
              onClick={() => signOut()}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p role="status">Checking your session…</p>
        )}
      </div>
    </main>
  );
}
