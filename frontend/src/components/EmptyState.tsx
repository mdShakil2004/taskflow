import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <h3 className="font-display text-base font-medium text-paper">{title}</h3>
      <p className="text-sm text-paper-muted max-w-sm">{description}</p>
      {action}
    </div>
  );
}
