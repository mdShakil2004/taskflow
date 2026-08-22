export const NOTIFICATION_QUEUE_NAME = "task-assignment-notifications";

// "3 retries" is read as 3 retries AFTER the initial attempt = 4 total
// attempts, matching the 3-delay backoff sequence (1s -> 2s -> 4s) specified
// in the assignment. See docs/technical-decisions.md for the full rationale.
export const NOTIFICATION_JOB_ATTEMPTS = 4;
export const NOTIFICATION_JOB_BACKOFF_MS = 1000;
