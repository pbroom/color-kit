#!/usr/bin/env node
// Parallel workspace build.
//
// The docs app resolves every workspace package from source via Vite aliases
// (see apps/docs/vite.config.ts), so its production build has no real
// dependency on the packages' built `dist` output. `pnpm -r build` still forces
// docs to wait for all packages because of workspace topological ordering.
//
// This runner builds the publishable packages (in their own topological order)
// and the independent docs app concurrently, cutting wall-clock build time
// roughly in half while preserving the package -> package build order that DTS
// generation depends on.

import { spawn } from 'node:child_process';

/** @param {string} name @param {string[]} args */
function run(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      stdio: 'inherit',
      // On Windows, pnpm resolves to pnpm.cmd, which spawn() only finds via the shell.
      shell: process.platform === 'win32',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} build failed (exit code ${code})`));
      }
    });
  });
}

const tasks = [
  // Packages build in workspace topological order (core before its dependents),
  // which DTS generation relies on. Docs is excluded and built separately.
  run('packages', ['--filter', '!@color-kit/docs', '-r', 'build']),
  // Docs reads packages from source, so it can build alongside the packages.
  run('docs', ['--filter', '@color-kit/docs', 'build']),
];

const results = await Promise.allSettled(tasks);
const failures = results.filter((result) => result.status === 'rejected');

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(String(failure.reason?.message ?? failure.reason));
  }
  process.exit(1);
}
