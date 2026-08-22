export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-paper-muted text-sm">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-ink-line border-t-signal-blue animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}
