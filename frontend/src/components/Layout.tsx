import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/projects", label: "Projects" },
  { to: "/members", label: "Members" },
  { to: "/jobs", label: "Job lookup" },
];

export function Layout() {
  const { user, organizations, currentOrganizationId, currentRole, switchOrganization, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col sm:flex-row">
      <aside className="w-full sm:w-60 sm:shrink-0 border-b sm:border-b-0 sm:border-r border-ink-line bg-ink-panel flex flex-col">
        <div className="px-5 py-5 border-b border-ink-line">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-signal-amber animate-pulse-dot" aria-hidden />
            <span className="font-display font-semibold text-[15px] tracking-tight">TaskFlow</span>
          </div>
          <p className="text-[11px] font-mono text-paper-faint mt-0.5">dispatch console</p>
        </div>

        <div className="px-5 py-4 border-b border-ink-line">
          <label className="label" htmlFor="org-switcher">
            Organization
          </label>
          <select
            id="org-switcher"
            className="field text-sm"
            value={currentOrganizationId ?? ""}
            onChange={(e) => switchOrganization(e.target.value)}
          >
            {organizations.map((org) => (
              <option key={org.organizationId} value={org.organizationId}>
                {org.organizationName}
              </option>
            ))}
          </select>
          {currentRole && (
            <span className="chip mt-2 border-signal-blue/30 bg-signal-blue/10 text-signal-blue">
              {currentRole}
            </span>
          )}
        </div>

        <nav className="flex sm:flex-1 flex-row sm:flex-col overflow-x-auto sm:overflow-visible px-3 py-2 sm:py-4 gap-0.5 sm:space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink-raised text-paper" : "text-paper-muted hover:text-paper hover:bg-ink-raised"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button onClick={handleLogout} className="sm:hidden ml-auto whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-paper-muted hover:text-paper">
            Sign out
          </button>
        </nav>

        <div className="hidden sm:block px-5 py-4 border-t border-ink-line">
          <p className="text-sm text-paper truncate">{user?.fullName}</p>
          <p className="text-xs font-mono text-paper-faint truncate">{user?.email}</p>
          <button onClick={handleLogout} className="btn-ghost mt-3 w-full justify-start px-0">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
