// Run the API (with --watch) and the Vite dev server together.
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const API_PORT = Number(process.env.PORT) || 3001;
const WEB_PORT = 5173;
const isWin = process.platform === 'win32';

/** Is anything already listening on this port (IPv4 or IPv6 localhost)? */
function inUse(port) {
  const probe = (host) =>
    new Promise((resolve) => {
      const s = net.connect({ port, host });
      s.setTimeout(800);
      s.once('connect', () => (s.destroy(), resolve(true)));
      s.once('timeout', () => (s.destroy(), resolve(false)));
      s.once('error', () => resolve(false));
    });
  return Promise.all([probe('127.0.0.1'), probe('::1')]).then((r) => r.some(Boolean));
}

// A server left over from an earlier run would otherwise keep answering on
// these ports, so the browser would get old code. Refuse to start instead.
const busy = [];
for (const port of [API_PORT, WEB_PORT]) if (await inUse(port)) busy.push(port);
if (busy.length) {
  console.error(`\nPort ${busy.join(' and ')} ${busy.length > 1 ? 'are' : 'is'} already in use, probably by an earlier Tastemate run that's still going.`);
  console.error('Close any other terminal running it, or stop it with:\n');
  console.error(`    npx kill-port ${busy.join(' ')}\n`);
  console.error('Then run npm run dev again.\n');
  process.exit(1);
}

// On Windows, npm is npm.cmd, which needs a shell to run. Elsewhere each child
// gets its own process group, so stopping it also stops what it started.
const opts = { stdio: 'inherit', shell: isWin, detached: !isWin };
const procs = [spawn('npm', ['run', 'dev:server'], opts), spawn('npm', ['run', 'dev:web'], opts)];

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) {
    if (p.exitCode !== null) continue;
    // Kill the whole tree: killing only the npm/shell process can leave the
    // node servers running and holding the ports.
    if (isWin) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-p.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
}
process.on('SIGINT', () => (stop(), process.exit(130)));
process.on('SIGTERM', () => (stop(), process.exit(143)));
process.on('SIGHUP', () => (stop(), process.exit(129)));
process.on('exit', stop);
procs.forEach((p) =>
  p.on('exit', (code) => {
    stop();
    process.exitCode = code ?? 0;
  })
);
