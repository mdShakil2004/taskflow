import type { TaskPriority } from "../api/types";

// The signature "status rail" — a colored bar keyed to priority, run down
// the left edge of every task row, so priority reads at a glance without
// needing a separate column. Directly mirrors a dispatch board's priority
// flags rather than a generic badge.
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: "bg-signal-red",
  high: "bg-signal-amber",
  medium: "bg-signal-blue",
  low: "bg-signal-ash",
};

export function PriorityRail({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-block h-full w-1 self-stretch rounded-full ${PRIORITY_COLOR[priority]}`}
      aria-hidden
    />
  );
}

export function PriorityLabel({ priority }: { priority: TaskPriority }) {
  const dotColor = PRIORITY_COLOR[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-paper-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
      {priority}
    </span>
  );
}
