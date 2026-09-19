export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
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
