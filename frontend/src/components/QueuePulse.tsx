import { useEffect, useRef, useState } from "react";
import { jobApi } from "../api/endpoints";
import type { JobStatus, JobStatusResponse } from "../api/types";

const STATUS_META: Record<JobStatus, { color: string; ring: string; label: string }> = {
  pending: { color: "bg-signal-ash", ring: "ring-signal-ash/30", label: "queued" },
  active: { color: "bg-signal-amber", ring: "ring-signal-amber/30", label: "processing" },
  completed: { color: "bg-signal-green", ring: "ring-signal-green/30", label: "delivered" },
  failed: { color: "bg-signal-red", ring: "ring-signal-red/30", label: "failed" },
};

/**
 * The console's signature element: a live queue-status indicator. Polls
 * GET /jobs/:id every 2s while the job is pending/active, stops once it
 * reaches a terminal state, and renders a pulsing signal dot whose color
 * moves through the same palette as task status — reinforcing that a task
 * assignment and its background notification are one continuous flow, not
 * two disconnected systems.
 */
export function QueuePulse({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await jobApi.getStatus(jobId);
        if (cancelled) return;
        setJob(result);
        if (result.status === "completed" || result.status === "failed") {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
        }
      } catch {
        if (!cancelled) setError("Job not found");
      }
    }

    poll();
    intervalRef.current = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [jobId]);

  if (error) {
    return <span className="text-xs font-mono text-paper-faint">{error}</span>;
  }
  if (!job) {
    return <span className="text-xs font-mono text-paper-faint">connecting…</span>;
  }

  const meta = STATUS_META[job.status];
  const isLive = job.status === "pending" || job.status === "active";

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-ink-line bg-ink px-3 py-1.5">
      <span className={`relative flex h-2.5 w-2.5`}>
        {isLive && (
          <span
            className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${meta.color} opacity-60`}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.color}`} />
      </span>
      <span className="text-xs font-mono text-paper">
        job <span className="text-paper-muted">{jobId.slice(0, 8)}</span>
      </span>
      <span className="text-xs font-mono uppercase tracking-wide text-paper-muted">{meta.label}</span>
      {job.metadata.attemptsMade !== undefined && job.metadata.attemptsMade > 0 && (
        <span className="text-xs font-mono text-signal-amber">
          attempt {job.metadata.attemptsMade}
        </span>
      )}
    </div>
  );
}
