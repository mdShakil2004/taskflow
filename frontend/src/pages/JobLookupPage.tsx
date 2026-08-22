import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { QueuePulse } from "../components/QueuePulse";

export function JobLookupPage() {
  const [jobIdInput, setJobIdInput] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (jobIdInput.trim()) setActiveJobId(jobIdInput.trim());
  }

  return (
    <div>
      <PageHeader eyebrow="background jobs" title="Job lookup" />

      <div className="px-8 py-6 space-y-6 max-w-xl">
        <p className="text-sm text-paper-muted">
          Paste a notification job id (returned when you assign a task) to watch it move through
          the queue live — <span className="font-mono text-paper-faint">pending → active → completed / failed</span>.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="field font-mono"
            placeholder="job id…"
            value={jobIdInput}
            onChange={(e) => setJobIdInput(e.target.value)}
          />
          <button type="submit" className="btn-primary shrink-0">Watch</button>
        </form>

        {activeJobId && (
          <div className="panel p-5">
            <QueuePulse jobId={activeJobId} />
          </div>
        )}
      </div>
    </div>
  );
}
