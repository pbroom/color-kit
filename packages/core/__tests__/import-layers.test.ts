import { describe, expect, it } from 'vitest';

// Core has no @types/node, so load the Node built-ins through non-literal
// specifiers with the minimal shapes this test needs.
interface NodeFs {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
}
interface NodePath {
  dirname(path: string): string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  resolve(...parts: string[]): string;
  sep: string;
}
interface NodeUrl {
  fileURLToPath(url: string): string;
}
const fsModule = 'node:fs';
const pathModule = 'node:path';
const urlModule = 'node:url';
const { readdirSync, readFileSync, statSync } = (await import(
  /* @vite-ignore */ fsModule
)) as NodeFs;
const { dirname, join, relative, resolve, sep } = (await import(
  /* @vite-ignore */ pathModule
)) as NodePath;
const { fileURLToPath } = (await import(
  /* @vite-ignore */ urlModule
)) as NodeUrl;

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]/g;

/** Top-level `src/` directory (layer) a source path belongs to. */
function layerOf(path: string): string {
  const [first] = relative(SRC_ROOT, path).split(sep);
  return first.endsWith('.ts') ? first.replace(/\.ts$/, '') : first;
}

interface ImportEdge {
  from: string;
  to: string;
  fromLayer: string;
  toLayer: string;
}

function collectImportEdges(): ImportEdge[] {
  return listSourceFiles(SRC_ROOT).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(IMPORT_PATTERN)].map((match) => {
      const target = resolve(dirname(file), match[1]);
      return {
        from: relative(SRC_ROOT, file),
        to: relative(SRC_ROOT, target),
        fromLayer: layerOf(file),
        toLayer: layerOf(target),
      };
    });
  });
}

const edges = collectImportEdges();

function violations(fromLayer: string, forbidden: string[]): string[] {
  return edges
    .filter(
      (edge) =>
        edge.fromLayer === fromLayer && forbidden.includes(edge.toLayer),
    )
    .map((edge) => `${edge.from} -> ${edge.to}`);
}

describe('core import layering', () => {
  it('finds relative imports to scan', () => {
    expect(edges.length).toBeGreaterThan(50);
    expect(edges.some((edge) => edge.fromLayer === 'contrast')).toBe(true);
    expect(edges.some((edge) => edge.fromLayer === 'trace')).toBe(true);
  });

  it('keeps geometry a leaf', () => {
    expect(
      violations('geometry', [
        'gamut',
        'contrast',
        'trace',
        'plane',
        'compute',
      ]),
    ).toEqual([]);
  });

  it('keeps gamut below contrast, trace, plane and compute', () => {
    expect(
      violations('gamut', ['contrast', 'trace', 'plane', 'compute']),
    ).toEqual([]);
  });

  it('does not let contrast import plane or compute', () => {
    expect(violations('contrast', ['plane', 'compute'])).toEqual([]);
  });

  it('does not let trace import plane or compute', () => {
    expect(violations('trace', ['plane', 'compute'])).toEqual([]);
  });

  it('does not let plane import compute', () => {
    expect(violations('plane', ['compute'])).toEqual([]);
  });
});
