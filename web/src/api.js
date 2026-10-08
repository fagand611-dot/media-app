// Thin fetch wrapper for the JSON API.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // The server's generic 404 (as opposed to e.g. "Item not found") means this
  // address doesn't exist on it, which happens when an older server is still running.
  if (res.status === 404 && data.error === 'Not found') {
    throw new ApiError(404, 'The server is out of date. Stop npm run dev, run "npx kill-port 3001 5173", then start npm run dev again.');
  }
  if (!res.ok) throw new ApiError(res.status, data.error || res.statusText);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

export const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== ''));
  const s = p.toString();
  return s ? `?${s}` : '';
};
