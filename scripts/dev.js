// Run the API (with --watch) and the Vite dev server together.
import { spawn } from 'node:child_process';

// On Windows, npm is npm.cmd, which needs a shell to run.
const opts = { stdio: 'inherit', shell: process.platform === 'win32' };
const procs = [spawn('npm', ['run', 'dev:server'], opts), spawn('npm', ['run', 'dev:web'], opts)];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));
