/**
 * Typed error thrown by the API client. Carries the HTTP status and the
 * raw body of the response so UI code can branch on status (401, 404, etc.)
 * without parsing strings.
 */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {unknown} [body]
   * @param {unknown} [trace]
   */
  constructor(status, message, body, trace) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.trace = trace;
  }
}
