class HttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.expose = options.expose ?? statusCode < 500;
    this.cause = options.cause;
  }
}

module.exports = { HttpError };
