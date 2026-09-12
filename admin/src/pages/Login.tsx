import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { errorText } from "../lib/api";
import { Field } from "../components/ui";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
            <path d="M16 26c0-8 5-12 11-13-1 7-5 11-11 13z" fill="#1B5E3B" />
            <path d="M16 26c0-9-6-14-12-15 3 8 6 13 12 15z" fill="#4B8B63" />
          </svg>
          Uzhavan
        </div>
        <p className="small muted" style={{ textAlign: "center", paddingBottom: 4 }}>
          Admin &amp; support console
        </p>

        <div className="card-body" style={{ paddingTop: 12 }}>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@uzhavan.app"
              autoComplete="username"
              autoFocus
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </Field>

          {error ? (
            <p className="err" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}

          <button className="btn" style={{ width: "100%", marginTop: 16 }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="small faint" style={{ marginTop: 14, textAlign: "center" }}>
            Staff accounts only. Buyers, farmers and drivers use the mobile apps.
          </p>
        </div>
      </form>
    </div>
  );
}
