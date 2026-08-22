import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";
import { logger } from "../shared/utils/logger";

/**
 * Single place that turns any thrown error into the API's consistent
 * response shape: { error, code, details }. Never leaks stack traces, SQL
 * errors, or other internals to the client — those are logged server-side only.
 */
export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ err: error, path: request.url }, "Unhandled application error");
    }
    reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: { issues: error.issues },
    });
    return;
  }

  // Fastify's built-in rate-limit plugin throws a FastifyError with statusCode 429.
  const fastifyErr = error as FastifyError;
  if (fastifyErr.statusCode === 429) {
    reply.status(429).send({
      error: "Too many requests",
      code: "RATE_LIMITED",
      details: {},
    });
    return;
  }

  logger.error({ err: error, path: request.url }, "Unexpected error");
  reply.status(500).send({
    error: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
    details: {},
  });
}
