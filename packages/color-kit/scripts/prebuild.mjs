import { spawnSync } from 'node:child_process';
import process from 'node:process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const skipWasmGenerated = /^(1|true)$/i.test(
  process.env.COLOR_KIT_SKIP_WASM_GENERATED ?? '',
);

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
run([
  '--filter',
  '@color-kit/core-wasm',
  skipWasmGenerated ? 'build' : 'build:all',
]);
run(['--filter', '@color-kit/react', 'build']);
