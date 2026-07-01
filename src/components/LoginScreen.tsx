import { useState } from "react";
import { login } from "@/lib/auth";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await login(username, password);
    setSubmitting(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm space-y-4"
      >
        <div>
          <div className="text-lg font-bold" style={{ color: "var(--navy)" }}>TLP</div>
          <h1 className="mt-1 text-xl font-semibold text-text-primary">Sign in</h1>
          <p className="text-sm text-text-secondary">Client Account Monitor</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
          <input
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
          />
        </div>

        {error && (
          <div className="text-sm rounded px-3 py-2" style={{ background: "rgba(231,76,60,0.1)", color: "#C0392B" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full rounded text-white text-sm font-medium py-2 disabled:opacity-40"
          style={{ background: "var(--navy)" }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
