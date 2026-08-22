import { useEffect, useState } from "react";
import { memberApi } from "../api/endpoints";
import type { Member, OrgRole } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../lib/errors";

export function MembersPage() {
  const { currentRole, currentOrganizationId, user } = useAuth();
  const { push } = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [isAdding, setIsAdding] = useState(false);

  const isAdmin = currentRole === "org_admin";

  async function load() {
    setError(null);
    try {
      const res = await memberApi.list();
      setMembers(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    setMembers(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setIsAdding(true);
    try {
      await memberApi.add({ email, role });
      push(`Added ${email}`, "success");
      setEmail("");
      setRole("member");
      await load();
    } catch (err) {
      push(getErrorMessage(err), "error");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: OrgRole) {
    try {
      await memberApi.updateRole(userId, newRole);
      push("Role updated", "success");
      await load();
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  async function handleRemove(userId: string, email: string) {
    if (!window.confirm(`Remove ${email} from this organization?`)) return;
    try {
      await memberApi.remove(userId);
      push("Member removed", "success");
      await load();
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  return (
    <div>
      <PageHeader eyebrow="organization" title="Members" />

      <div className="px-8 py-6 space-y-6">
        {!isAdmin && (
          <p className="text-sm text-paper-faint">
            You're a <span className="font-mono">member</span> — role changes and additions require org_admin.
          </p>
        )}

        {isAdmin && (
          <form onSubmit={handleAdd} className="panel p-5 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="label" htmlFor="email">User email (must already have a TaskFlow account)</label>
              <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="role">Role</label>
              <select id="role" className="field" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                <option value="member">member</option>
                <option value="org_admin">org_admin</option>
              </select>
            </div>
            <button type="submit" disabled={isAdding} className="btn-primary">
              {isAdding ? "Adding…" : "Add member"}
            </button>
          </form>
        )}

        {error && <ErrorBanner message={error} />}
        {!members && !error && <Spinner label="Loading members…" />}

        {members && (
          <div className="panel divide-y divide-ink-line overflow-hidden">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-paper truncate">
                    {m.user.fullName}
                    {m.userId === user?.id && <span className="text-paper-faint"> (you)</span>}
                  </p>
                  <p className="text-xs font-mono text-paper-faint truncate">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isAdmin ? (
                    <select
                      className="field w-auto text-xs py-1"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.userId, e.target.value as OrgRole)}
                    >
                      <option value="member">member</option>
                      <option value="org_admin">org_admin</option>
                    </select>
                  ) : (
                    <span className="chip border-signal-blue/30 bg-signal-blue/10 text-signal-blue">{m.role}</span>
                  )}
                  {isAdmin && (
                    <button className="text-xs text-signal-red hover:underline" onClick={() => handleRemove(m.userId, m.user.email)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
