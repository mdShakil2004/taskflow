import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-ink-line px-8 py-6">
      <div>
        {eyebrow && (
          <div className="text-xs font-mono uppercase tracking-wider text-paper-faint mb-1">{eyebrow}</div>
        )}
        <h1 className="font-display text-xl font-semibold text-paper">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
