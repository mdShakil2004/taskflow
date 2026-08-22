import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/errors";
import { ErrorBanner } from "../components/ErrorBanner";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ fullName, email, password, organizationName });
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
          <h1 className="font-display text-lg font-semibold mb-1">Create your organization</h1>
          <p className="text-sm text-paper-muted mb-5">You'll be the first admin.</p>

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="fullName">Full name</label>
              <input id="fullName" required className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" required minLength={8} className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="organizationName">Organization name</label>
              <input id="organizationName" required className="field" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Creating…" : "Create organization"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-paper-muted mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-signal-blue hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
