import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/errors";
import { ErrorBanner } from "../components/ErrorBanner";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@nimbus.example");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/projects");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-signal-amber animate-pulse-dot" aria-hidden />
          <span className="font-display text-lg font-semibold tracking-tight">TaskFlow</span>
          <span className="text-xs font-mono text-paper-faint">/ console</span>
        </div>

        <div className="panel p-6">
          <h1 className="font-display text-lg font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-paper-muted mb-5">Access your organization's queue.</p>

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-paper-muted mt-5">
          No account?{" "}
          <Link to="/register" className="text-signal-blue hover:underline">
            Register an organization
          </Link>
        </p>

        <p className="text-center text-xs font-mono text-paper-faint mt-6">
          seed demo: admin@nimbus.example · DemoPass123!
        </p>
      </div>
    </div>
  );
}
