import pino from "pino";
import { config } from "../../config";

// Structured logging. In development, pretty-print for readability; in
// production, emit plain JSON for log aggregation. Never pass raw request
// bodies containing passwords/tokens to this logger — redact at call sites.
export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.passwordHash", "*.token", "*.refreshToken"],
    censor: "[REDACTED]",
  },
});
