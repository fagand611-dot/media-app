import { openDb } from './db.js';
import { createApp } from './app.js';
import { seedCatalog } from './seed/seed.js';

const db = openDb();
// The first run on an empty database loads the built-in catalogue, so the app is usable straight away.
if (!db.prepare('SELECT 1 FROM items LIMIT 1').get()) {
  const n = seedCatalog(db);
  console.log(`Seeded ${n} catalogue items`);
}

const port = Number(process.env.PORT) || 3001;
createApp({ db })
  .listen(port, () => console.log(`Tastemate API on http://localhost:${port}`))
  .on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`\nPort ${port} is already in use, probably by an earlier Tastemate server that's still running.`);
    console.error(`Stop it (close that terminal, or run: npx kill-port ${port}) and start again.\n`);
    process.exit(1);
  });
