import { ApiError } from "../api/client";

// Maps common HTTP statuses to plain-language prefixes, per the backend's
// documented error semantics (see taskflow/docs/technical-decisions.md and
// the AppError codes). The underlying backend message + code is still
// appended so nothing is hidden — this only adds context, never replaces it.
const STATUS_PREFIX: Record<number, string> = {
  401: "Session expired or authentication required",
  403: "You don't have permission to do that",
  404: "Not found",
  409: "Conflict",
  422: "Validation problem",
  429: "Too many requests — slow down and try again",
  500: "Unexpected server error",
};

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const prefix = STATUS_PREFIX[err.status];
    const detail = `${err.message}${err.code ? ` (${err.code})` : ""}`;
    return prefix ? `${prefix}: ${detail}` : detail;
  }
  if (err instanceof TypeError) {
    // fetch() throws a bare TypeError on network failure / CORS / DNS —
    // give the user something actionable instead of "Failed to fetch".
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
