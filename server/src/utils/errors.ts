export class AppError extends Error {
  status: number;
  code: string;
  retryable?: boolean;
  retryAfterSeconds?: number;

  constructor(message: string, status = 400, code = "BAD_REQUEST", options: { retryable?: boolean; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.retryable = options.retryable;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function notFound(message: string, code = "NOT_FOUND"): AppError {
  return new AppError(message, 404, code);
}

export function conflict(message: string, code = "CONFLICT"): AppError {
  return new AppError(message, 409, code);
}

export function unavailable(message: string, code = "UNAVAILABLE"): AppError {
  return new AppError(message, 503, code);
}
