import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const PACKAGE_ROOTS = ['packages', 'apps'];

function parseMajor(version) {
  const match = /^(\d+)(?:\.|$)/.exec(version);
  return match ? Number(match[1]) : null;
}

async function collectPackageJsonPaths() {
  const packageJsonPaths = [];

  for (const root of PACKAGE_ROOTS) {
    let entries = [];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      packageJsonPaths.push(path.join(root, entry.name, 'package.json'));
    }
  }

  return packageJsonPaths;
}

async function main() {
  const errors = [];
  const packageJsonPaths = await collectPackageJsonPaths();

  for (const packageJsonPath of packageJsonPaths) {
    let raw;
    try {
      raw = await readFile(packageJsonPath, 'utf8');
    } catch {
      continue;
    }

    const pkg = JSON.parse(raw);
    if (pkg.private === true) {
      continue;
    }

    if (typeof pkg.version !== 'string') {
      errors.push(`${packageJsonPath}: missing string version`);
      continue;
    }

    const major = parseMajor(pkg.version);
    if (major === null) {
      errors.push(
        `${packageJsonPath}: invalid semver version "${pkg.version}"`,
      );
      continue;
    }

    if (major >= 1) {
      errors.push(
        `${packageJsonPath}: ${pkg.name ?? 'package'} is ${pkg.version}; pre-production policy requires < 1.0.0`,
      );
    }
  }

  if (errors.length > 0) {
    console.error('Pre-production version guard failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    'Pre-production version guard passed: all publishable workspace packages are < 1.0.0.',
  );
}

await main();
