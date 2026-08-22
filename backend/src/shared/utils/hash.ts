import { createHash } from "crypto";

// Refresh tokens are stored only as a SHA-256 hash, never plaintext, so a
// database read alone can't be replayed as a valid session token.
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
