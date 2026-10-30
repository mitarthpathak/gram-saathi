/** Throw from any handler or service; errorHandler turns it into an `ApiErrorBody` response. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Thrown by the non-mock code paths that later steps will fill in. */
export class NotImplementedError extends HttpError {
  constructor(feature: string) {
    super(501, 'NOT_IMPLEMENTED', `${feature} is not implemented yet. Run with USE_MOCKS=true.`);
    this.name = 'NotImplementedError';
  }
}
