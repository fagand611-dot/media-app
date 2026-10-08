export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async handler so rejected promises reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Parse a positive integer route/query param or throw 400. */
export function intParam(v, name = 'id') {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `Invalid ${name}`);
  return n;
}
