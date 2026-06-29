export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean; // operational = expected error (404, 401, etc.)

  constructor(
    statusCode: number,
    message: string,
    isOperational = true, // false = programmer error (unexpected bug)
    stack?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8 (Node.js)
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    // Set the prototype explicitly — required when extending built-in classes in TS
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  // ── Convenience static factories ──────────────────────────────────────────
  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message: string) {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  static unprocessable(message: string) {
    return new ApiError(422, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}