import type { TaskStatus } from "../api/types";

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; text: string }> = {
  todo: { label: "todo", dot: "bg-signal-ash", text: "text-paper-muted" },
  in_progress: { label: "in_progress", dot: "bg-signal-amber", text: "text-signal-amber" },
  review: { label: "review", dot: "bg-signal-blue", text: "text-signal-blue" },
  done: { label: "done", dot: "bg-signal-green", text: "text-signal-green" },
};

export function StatusPill({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`chip border-current/20 bg-current/10 ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}
