import { logger } from "../../shared/utils/logger";

export interface MockEmailPayload {
  to: string;
  subject: string;
  body: string;
}

// Mock email transport — logs instead of sending. Never logs tokens/secrets,
// and only logs the fields needed to demonstrate delivery.
export async function sendMockEmail(payload: MockEmailPayload): Promise<void> {
  logger.info({ to: payload.to, subject: payload.subject }, "Mock email dispatched");
}
