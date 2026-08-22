import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { assignmentApi, commentApi, memberApi, taskApi } from "../api/endpoints";
import type { Comment, Member, Task, TaskPriority, TaskStatus } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { PriorityLabel } from "../components/PriorityRail";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { QueuePulse } from "../components/QueuePulse";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../lib/errors";

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { push } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [assigneeId, setAssigneeId] = useState("");
  const [latestJobId, setLatestJobId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  async function load() {
    if (!taskId) return;
    setError(null);
    try {
      const [t, m, c] = await Promise.all([
        taskApi.get(taskId),
        memberApi.list(),
        commentApi.list(taskId),
      ]);
      setTask(t);
      setMembers(m.data);
      setComments(c.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleStatusChange(status: TaskStatus) {
    if (!taskId) return;
    try {
      const updated = await taskApi.update(taskId, { status });
      setTask(updated);
      push(`Status set to ${status}`, "success");
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  async function handlePriorityChange(priority: TaskPriority) {
    if (!taskId) return;
    try {
      const updated = await taskApi.update(taskId, { priority });
      setTask(updated);
      push(`Priority set to ${priority}`, "success");
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !assigneeId) return;
    try {
      const result = await assignmentApi.assign(taskId, assigneeId);
      push("Task assigned — notification job enqueued", "success");
      if (result.jobId) setLatestJobId(result.jobId);
      setAssigneeId("");
      await load();
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  async function handleUnassign(userId: string) {
    if (!taskId) return;
    try {
      await assignmentApi.unassign(taskId, userId);
      push("Unassigned", "success");
      await load();
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  async function handleDeleteTask() {
    if (!taskId || !task || !window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await taskApi.remove(taskId);
      push("Task deleted", "success");
      navigate(`/projects/${task.projectId}`);
    } catch (err) {
      push(getErrorMessage(err), "error");
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !commentBody.trim()) return;
    setIsSubmittingComment(true);
    try {
      await commentApi.create(taskId, commentBody.trim());
      setCommentBody("");
      const { data } = await commentApi.list(taskId);
      setComments(data);
    } catch (err) {
      push(getErrorMessage(err), "error");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  if (error) {
    return (
      <div className="px-8 py-6">
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="px-8 py-6">
        <Spinner label="Loading task…" />
      </div>
    );
  }

  const assignedUserIds = new Set(task.assignments?.map((a) => a.userId) ?? []);
  const unassignedMembers = members.filter((m) => !assignedUserIds.has(m.userId));

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to={`/projects/${task.projectId}`} className="hover:text-paper">
            ← back to project
          </Link>
        }
        title={task.title}
        actions={
          <button className="btn-danger" onClick={handleDeleteTask}>
            Delete task
          </button>
        }
      />

      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel p-5">
            <p className="text-xs font-mono text-paper-faint mb-3">{task.id}</p>
            <p className="text-sm text-paper-muted whitespace-pre-wrap">
              {task.description || "No description."}
            </p>

            <div className="flex flex-wrap gap-6 mt-5">
              <div>
                <label className="label">Status</label>
                <div className="flex gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`rounded-md px-2 py-1 transition-opacity ${task.status === s ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
                    >
                      <StatusPill status={s} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Priority</label>
                <div className="flex gap-1.5">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      className={`rounded-md border px-2 py-1 transition-colors ${
                        task.priority === p ? "border-signal-blue/50 bg-signal-blue/10" : "border-ink-line hover:border-ink-line/80"
                      }`}
                    >
                      <PriorityLabel priority={p} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="font-display text-sm font-medium text-paper mb-4">
              Comments <span className="text-paper-faint font-mono">({comments.length})</span>
            </h2>
            <div className="space-y-3 mb-4">
              {comments.length === 0 && <p className="text-sm text-paper-faint">No comments yet.</p>}
              {comments.map((c) => (
                <div key={c.id} className="border-l-2 border-ink-line pl-3">
                  <p className="text-sm text-paper">{c.body}</p>
                  <p className="text-xs font-mono text-paper-faint mt-1">
                    {c.author.fullName} · {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                className="field"
                placeholder="Add a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <button type="submit" disabled={isSubmittingComment} className="btn-secondary shrink-0">
                Post
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <h2 className="font-display text-sm font-medium text-paper mb-4">Assignees</h2>
            <div className="space-y-2 mb-4">
              {(task.assignments ?? []).length === 0 && (
                <p className="text-sm text-paper-faint">Unassigned.</p>
              )}
              {task.assignments?.map((a) => {
                const member = members.find((m) => m.userId === a.userId);
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-md bg-ink px-3 py-2">
                    <span className="text-sm text-paper truncate">
                      {member?.user.fullName ?? a.userId.slice(0, 8)}
                    </span>
                    <button className="text-xs text-signal-red hover:underline" onClick={() => handleUnassign(a.userId)}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAssign} className="flex gap-2">
              <select className="field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Assign to…</option>
                {unassignedMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user.fullName}</option>
                ))}
              </select>
              <button type="submit" disabled={!assigneeId} className="btn-primary shrink-0">
                Assign
              </button>
            </form>
          </div>

          {latestJobId && (
            <div className="panel p-5">
              <h2 className="font-display text-sm font-medium text-paper mb-3">Notification job</h2>
              <QueuePulse jobId={latestJobId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
