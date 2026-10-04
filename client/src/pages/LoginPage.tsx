import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../types";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login({ email, password });
      localStorage.setItem("recallloop_token", result.token);
      const goals = await api.listGoals().catch(() => null);
      navigate(goals && goals.goals.length === 0 ? "/onboarding" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Sign in to RecallLoop</h1>
        {error ? <p className="error">{error}</p> : null}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
