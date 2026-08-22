// Typed application errors mapped 1:1 onto the API's consistent error shape:
// { error, code, details }. Controllers/services throw these; the global
// error middleware translates them into HTTP responses without ever leaking
// stack traces, SQL, or internals to the client.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "ORGANIZATION_NOT_FOUND"
  | "MEMBER_NOT_FOUND"
  | "ASSIGNMENT_NOT_FOUND"
  | "DUPLICATE_ASSIGNMENT"
  | "EMAIL_ALREADY_REGISTERED"
  | "INVALID_CREDENTIALS"
  | "INVALID_REFRESH_TOKEN"
  | "RATE_LIMITED"
  | "JOB_NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details: Record<string, unknown> = {}) {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(code: ErrorCode, message: string) {
    return new AppError(404, code, message);
  }
  static conflict(code: ErrorCode, message: string) {
    return new AppError(409, code, message);
  }
  static rateLimited(message = "Too many requests") {
    return new AppError(429, "RATE_LIMITED", message);
  }
  static internal(message = "Internal server error") {
    return new AppError(500, "INTERNAL_SERVER_ERROR", message);
  }
}
