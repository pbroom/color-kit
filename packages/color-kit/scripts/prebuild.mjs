import { spawnSync } from 'node:child_process';
import process from 'node:process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(args) {
  const result = spawnSync(pnpmCommand, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(['--filter', '@color-kit/core', 'build']);
run(['--filter', '@color-kit/driver', 'build']);
run(['--filter', '@color-kit/react', 'build']);
