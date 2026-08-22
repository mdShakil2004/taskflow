export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-signal-red/30 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">
      {message}
    </div>
  );
}
