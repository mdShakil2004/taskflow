export const DEAD_LETTER_QUEUE_NAME = "task-assignment-notifications-dlq";

// Outbox recovery sweep interval — how often the worker checks for
// still-pending outbox rows whose immediate enqueue attempt (in the API
// request path) may have failed.
export const OUTBOX_SWEEP_INTERVAL_MS = 10_000;
// Only sweep rows older than this grace period, so we don't race the API's
// own immediate-enqueue attempt for a row created a moment ago.
export const OUTBOX_SWEEP_GRACE_MS = 5_000;
