import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectApi, taskApi } from "../api/endpoints";
import type { DashboardCounts, Project, Task, TaskPriority, TaskStatus } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { PriorityRail } from "../components/PriorityRail";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../lib/errors";

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentRole } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [isCreating, setIsCreating] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function loadAll() {
    if (!projectId) return;
    setError(null);
    try {
      const [projectRes, dashboardRes] = await Promise.all([
        projectApi.get(projectId),
        projectApi.dashboard(projectId),
      ]);
      setProject(projectRes);
      setCounts(dashboardRes);
      await loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadTasks() {
    if (!projectId) return;
    try {
      const res = await taskApi.list(projectId, {
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: search || undefined,
        page,
        limit,
      });
      setTasks(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    setTasks(null);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, page]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadTasks();
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setIsCreating(true);
    try {
      await taskApi.create(projectId, { title, priority });
      setTitle("");
      setPriority("medium");
      setShowCreate(false);
      push("Task created", "success");
      await loadAll();
    } catch (err) {
      push(getErrorMessage(err), "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteProject() {
    if (!projectId || !window.confirm(`Delete "${project?.name}"? This soft-deletes the project.`)) return;
    try {
      await projectApi.remove(projectId);
      push("Project deleted", "success");
      navigate("/projects");
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStatus(status: TaskStatus) {
    if (selected.size === 0) return;
    try {
      const { updated } = await taskApi.bulkUpdateStatus(Array.from(selected), status);
      push(`Updated ${updated} task(s) to ${status}`, "success");
      setSelected(new Set());
      await loadAll();
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        eyebrow="project"
        title={project?.name ?? "…"}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "New task"}
            </button>
            {currentRole === "org_admin" && (
              <button className="btn-danger" onClick={handleDeleteProject}>
                Delete project
              </button>
            )}
          </>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {error && <ErrorBanner message={error} />}

        {counts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATUS_OPTIONS.map((s) => (
              <div key={s} className="panel px-4 py-3">
                <StatusPill status={s} />
                <p className="font-display text-2xl font-semibold text-paper mt-2">{counts[s]}</p>
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <form onSubmit={handleCreateTask} className="panel p-5 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="label" htmlFor="title">Title</label>
              <input id="title" required className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="priority">Priority</label>
              <select id="priority" className="field" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={isCreating} className="btn-primary">
              {isCreating ? "Creating…" : "Create task"}
            </button>
          </form>
        )}

        <div className="panel p-4 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              className="field"
              placeholder="Search title & description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-secondary shrink-0">Search</button>
          </form>
          <select className="field w-auto" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value as TaskStatus | ""); }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="field w-auto" value={priorityFilter} onChange={(e) => { setPage(1); setPriorityFilter(e.target.value as TaskPriority | ""); }}>
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <div className="panel p-3 flex items-center gap-3 border-signal-blue/40">
            <span className="text-sm text-paper-muted">{selected.size} selected</span>
            <span className="text-xs font-mono text-paper-faint">bulk set status →</span>
            {STATUS_OPTIONS.map((s) => (
              <button key={s} className="btn-secondary text-xs" onClick={() => handleBulkStatus(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {!tasks && !error && <Spinner label="Loading tasks…" />}

        {tasks && tasks.length === 0 && (
          <EmptyState title="No tasks match" description="Adjust your filters or create a new task for this project." />
        )}

        {tasks && tasks.length > 0 && (
          <div className="panel divide-y divide-ink-line overflow-hidden">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-stretch gap-3 px-4 py-3 hover:bg-ink-raised/50 transition-colors">
                <PriorityRail priority={t.priority} />
                <input
                  type="checkbox"
                  className="mt-1 accent-signal-blue"
                  checked={selected.has(t.id)}
                  onChange={() => toggleSelected(t.id)}
                  aria-label={`Select ${t.title}`}
                />
                <Link to={`/tasks/${t.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-paper truncate">{t.title}</p>
                  <p className="text-xs font-mono text-paper-faint mt-0.5">
                    {t.id.slice(0, 8)} · {t.assignments?.length ?? 0} assignee(s)
                    {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
                  </p>
                </Link>
                <StatusPill status={t.status} />
              </div>
            ))}
          </div>
        )}

        {tasks && total > limit && (
          <div className="flex items-center justify-between text-sm text-paper-muted">
            <span>
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
