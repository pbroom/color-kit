/** Types for `entries.mjs`, which the drift test imports. */
export interface EntryPoint {
  /** URL slug (`core`, `plane`, …). */
  slug: string;
  /** Specifier users write (`color-kit/plane`). */
  importPath: string;
  /** Other specifiers that resolve to the same files. */
  aliases: string[];
  /** The `exports` key (`.`, `./plane`, …). */
  subpath: string;
  /** Every `exports` key served by this entry. */
  subpaths: string[];
  /** Built facade declaration file, relative to the facade. */
  dts: string;
  /** Source entry file, relative to the repo root. */
  source: string;
  /** Directory whose files this entry owns. */
  sourceDir: string;
  order: number;
  summary: string;
}

export const docsRoot: string;
export const repoRoot: string;
export const facadeRoot: string;
export const ENTRY_META: Record<string, { order: number; summary: string }>;
export function readEntryPoints(): EntryPoint[];
