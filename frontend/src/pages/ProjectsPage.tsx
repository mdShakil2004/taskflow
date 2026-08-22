import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { projectApi } from "../api/endpoints";
import type { Project } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../lib/errors";

export function ProjectsPage() {
  const { currentOrganizationId } = useAuth();
  const { push } = useToast();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await projectApi.list(1, 50);
      setProjects(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    setProjects(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      await projectApi.create({ name, description: description || undefined });
      setName("");
      setDescription("");
      setShowCreate(false);
      push("Project created", "success");
      await load();
    } catch (err) {
      push(getErrorMessage(err), "error");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="workspace"
        title="Projects"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "New project"}
          </button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {showCreate && (
          <form onSubmit={handleCreate} className="panel p-5 space-y-4 max-w-lg">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" required className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button type="submit" disabled={isCreating} className="btn-primary">
              {isCreating ? "Creating…" : "Create project"}
            </button>
          </form>
        )}

        {error && <ErrorBanner message={error} />}

        {!projects && !error && <Spinner label="Loading projects…" />}

        {projects && projects.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start tracking tasks for this organization."
            action={<button className="btn-primary mt-1" onClick={() => setShowCreate(true)}>New project</button>}
          />
        )}

        {projects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="panel p-4 hover:border-signal-blue/50 transition-colors block"
              >
                <h3 className="font-display font-medium text-paper mb-1">{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-paper-muted line-clamp-2">{p.description}</p>
                )}
                <p className="text-xs font-mono text-paper-faint mt-3">{p.id.slice(0, 8)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
