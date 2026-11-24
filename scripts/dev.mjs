#!/usr/bin/env node
/**
 * Cross-platform `npm run dev`: starts the API and the web app together on Windows
 * (PowerShell/cmd), Linux and macOS without extra dependencies. Output is prefixed per
 * process; Ctrl+C or the exit of either process stops both (process tree on Windows).
 */
import { spawn, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const tasks = [
  { name: 'api', color: 36, workspace: '@ecosoft/api' },
  { name: 'web', color: 35, workspace: '@ecosoft/web' },
];

const prefix = (name, color) =>
  process.stdout.isTTY ? `\x1b[${color}m[${name}]\x1b[0m ` : `[${name}] `;

const pipe = (stream, target, label) => {
  let buffered = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? '';
    for (const line of lines) target.write(`${label}${line}\n`);
  });
  stream.on('end', () => buffered && target.write(`${label}${buffered}\n`));
};

let shuttingDown = false;
const children = tasks.map(({ name, color, workspace }) => {
  const child = spawn('npm', ['run', 'dev', '--workspace', workspace], {
    // npm is a .cmd shim on Windows and needs a shell; elsewhere a process group lets us
    // stop tsx/vite watchers together with npm.
    shell: isWindows,
    detached: !isWindows,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });
  const label = prefix(name, color);
  pipe(child.stdout, process.stdout, label);
  pipe(child.stderr, process.stderr, label);
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      process.stderr.write(
        `${label}terminó (${signal ?? `código ${code}`}); deteniendo el resto.\n`,
      );
      shutdown(code ?? 1);
    }
  });
  return child;
});

const stop = (child) => {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
};

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(stop);
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
