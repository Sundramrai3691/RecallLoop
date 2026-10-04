import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../types";

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.register({ name, email, password });
      localStorage.setItem("recallloop_token", result.token);
      navigate("/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create account",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Create your RecallLoop account</h1>
        {error ? <p className="error">{error}</p> : null}
        <label htmlFor="name">Name</label>
        <input
          id="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
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
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Creating..." : "Create account"}
        </button>
        <p className="muted">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
