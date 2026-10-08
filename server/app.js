import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUser } from './auth.js';
import { createProviders } from './providers/index.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import discoverRoutes from './routes/discover.js';
import socialRoutes from './routes/social.js';

export function createApp({ db, providers = createProviders() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(loadUser(db));

  const ctx = { db, providers };
  const api = express.Router();
  authRoutes(api, ctx);
  itemRoutes(api, ctx);
  discoverRoutes(api, ctx);
  socialRoutes(api, ctx);
  api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use('/api', api);

  // Serve the built SPA in production.
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });
  return app;
}
