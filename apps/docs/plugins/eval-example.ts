import { createHash } from 'node:crypto';
import ts from 'typescript';
import {
  createServer,
  type Alias,
  type ModuleNode,
  type Plugin,
  type ResolvedConfig,
  type ViteDevServer,
} from 'vite';

/**
 * Build-time evaluation for docs examples, in Node, against color-kit
 * *source* (the same aliases as the site, so it never depends on `dist/`).
 *
 * Two uses, both driven by `plugins/highlight.ts`:
 *
 * - `evalExample(file, code)`: fills in `// →` result comments. A top-level
 *   statement followed by `// →` (same line, or alone on the next line) is
 *   run and the comment is rewritten to `// → <value>`. Expression
 *   statements show the expression's value; `const x = …` shows `x`.
 * - `loadBuildModule(file)`: imports a module and returns its exports, for
 *   `?build` imports whose values are computed at build time and inlined as
 *   JSON (the hero's prerendered frame).
 *
 * A dedicated, watch-free Vite server runs the modules (`ssrLoadModule`), so
 * TypeScript, `@/` and `color-kit/*` resolve exactly as in the site.
 */

const ARROW = '→';
const MARKER = /^\/\/\s*→/;

type WatchDependency = (file: string) => void;
type Loader = (
  id: string,
  watchDependency?: WatchDependency,
) => Promise<Record<string, unknown>>;

let aliases: Alias[] = [];
let root = process.cwd();
let isServe = false;
let serverPromise: Promise<ViteDevServer> | null = null;
const virtualModules = new Map<string, string>();

function evalServer(): Promise<ViteDevServer> {
  serverPromise ??= createServer({
    configFile: false,
    root,
    logLevel: 'error',
    appType: 'custom',
    resolve: { alias: aliases },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    plugins: [
      {
        name: 'color-kit:eval-virtual',
        enforce: 'pre',
        resolveId(id) {
          return virtualModules.has(id) ? id : null;
        },
        load(id) {
          return virtualModules.get(id) ?? null;
        },
      },
    ],
  });
  return serverPromise;
}

async function closeEvalServer(): Promise<void> {
  const pending = serverPromise;
  serverPromise = null;
  virtualModules.clear();
  if (pending) {
    await (await pending).close();
  }
}

const load: Loader = async (id, watchDependency) => {
  const server = await evalServer();
  if (isServe) {
    // The eval server does not watch files; start every dev eval fresh.
    server.moduleGraph.invalidateAll();
  }
  const exports = (await server.ssrLoadModule(id)) as Record<string, unknown>;
  // The evaluator has no watcher. Register its whole input graph with the
  // caller so Vite invalidates the virtual output when an input changes.
  const visited = new Set<ModuleNode>();
  const visit = (module: ModuleNode | undefined) => {
    if (!module || visited.has(module)) return;
    visited.add(module);
    if (module.file) watchDependency?.(module.file);
    for (const dependency of module.importedModules) visit(dependency);
  };
  visit(server.moduleGraph.getModuleById(id));
  return exports;
};

/** Import `file` at build time and return its exports. */
export function loadBuildModule(
  file: string,
  watchDependency?: WatchDependency,
): Promise<Record<string, unknown>> {
  return load(file, watchDependency);
}

// ---------------------------------------------------------------------------
// `// →` markers
// ---------------------------------------------------------------------------

interface Marker {
  index: number;
  /** Character range of the `// →…` comment in the original source. */
  start: number;
  end: number;
  /** Whether the comment sits on the statement's own line. */
  inline: boolean;
  /** Indentation of the comment's line (own-line markers). */
  indent: string;
  /** Column where the inline comment starts. */
  column: number;
}

function findMarker(
  code: string,
  statement: ts.Statement,
): Omit<Marker, 'index'> | null {
  for (const range of ts.getTrailingCommentRanges(code, statement.end) ?? []) {
    const text = code.slice(range.pos, range.end);
    if (range.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      if (MARKER.test(text)) {
        const lineStart = code.lastIndexOf('\n', range.pos) + 1;
        return {
          start: range.pos,
          end: range.end,
          inline: true,
          indent: '',
          column: range.pos - lineStart,
        };
      }
    }
  }
  // Own-line form: the very next line is `// → …` (plus continuation lines).
  const lineEnd = code.indexOf('\n', statement.end);
  if (lineEnd === -1) return null;
  const next = /^([ \t]*)(\/\/[^\n]*)/.exec(code.slice(lineEnd + 1));
  if (!next || !MARKER.test(next[2]!)) return null;
  const start = lineEnd + 1 + next[1]!.length;
  let end = start + next[2]!.length;
  // Swallow continuation lines (`//   …`) written by a previous run.
  const continuation = /^\n[ \t]*\/\/ {3}[^\n]*/;
  let match = continuation.exec(code.slice(end));
  while (match) {
    end += match[0].length;
    match = continuation.exec(code.slice(end));
  }
  return { start, end, inline: false, indent: next[1]!, column: 0 };
}

function instrument(
  file: string,
  code: string,
): { instrumented: string; markers: Marker[] } {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const markers: Marker[] = [];
  const edits: { at: number; remove?: number; text: string }[] = [];

  for (const statement of source.statements) {
    const marker = findMarker(code, statement);
    if (!marker) continue;
    const index = markers.length;
    if (ts.isExpressionStatement(statement)) {
      const expression = statement.expression;
      edits.push({
        at: expression.getStart(source),
        text: `__ckRecord(${index}, (`,
      });
      edits.push({ at: expression.end, text: '))' });
    } else if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      ts.isIdentifier(statement.declarationList.declarations[0]!.name)
    ) {
      const name = statement.declarationList.declarations[0]!.name.text;
      edits.push({
        at: statement.end,
        text: `\n__ckRecord(${index}, ${name});`,
      });
    } else {
      const { line } = source.getLineAndCharacterOfPosition(
        statement.getStart(source),
      );
      throw new Error(
        `${file}:${line + 1}: \`// ${ARROW}\` must follow an expression statement or a single \`const\` declaration`,
      );
    }
    markers.push({ index, ...marker });
  }

  let instrumented = code;
  for (const edit of edits.sort((a, b) => b.at - a.at)) {
    instrumented =
      instrumented.slice(0, edit.at) + edit.text + instrumented.slice(edit.at);
  }
  // Imports hoist, so these declarations may precede them.
  instrumented =
    'export const __ckResults: unknown[] = [];\n' +
    'const __ckRecord = <T,>(index: number, value: T): T => ((__ckResults[index] = value), value);\n' +
    instrumented;
  return { instrumented, markers };
}

// ---------------------------------------------------------------------------
// Value formatting: JS-literal style, numbers to 4 decimals
// ---------------------------------------------------------------------------

interface FormatState {
  rounded: boolean;
}

const MAX_ITEMS = 6;

function formatNumber(value: number, state: FormatState): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
  if (Object.is(value, -0)) return '0';
  const rounded = Number(value.toFixed(4));
  if (rounded !== value) state.rounded = true;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function formatKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`;
}

function formatValue(value: unknown, state: FormatState, depth = 0): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'undefined':
      return 'undefined';
    case 'number':
      return formatNumber(value, state);
    case 'boolean':
    case 'bigint':
      return String(value);
    case 'string':
      return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
    case 'function':
      return `[Function ${value.name || 'anonymous'}]`;
    case 'symbol':
      return value.toString();
  }
  if (depth > 3) return '…';
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const items = Array.from(value as unknown as ArrayLike<number>);
    return `${value.constructor.name}(${items.length}) ${formatList(items, state, depth)}`;
  }
  if (Array.isArray(value)) {
    return formatList(value, state, depth);
  }
  if (value instanceof Map) {
    return `Map(${value.size})`;
  }
  if (value instanceof Set) {
    return `Set(${value.size})`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return `{ ${entries
    .map(
      ([key, entry]) =>
        `${formatKey(key)}: ${formatValue(entry, state, depth + 1)}`,
    )
    .join(', ')} }`;
}

function formatList(
  items: readonly unknown[],
  state: FormatState,
  depth: number,
): string {
  const shown = items
    .slice(0, MAX_ITEMS)
    .map((item) => formatValue(item, state, depth + 1));
  if (items.length > MAX_ITEMS) {
    shown.push(`… ${items.length - MAX_ITEMS} more`);
  }
  return `[${shown.join(', ')}]`;
}

/** Format a value as `// →` shows it: a JS literal, `≈` when rounded. */
export function formatResult(value: unknown): string {
  const state: FormatState = { rounded: false };
  const text = formatValue(value, state);
  return state.rounded ? `≈ ${text}` : text;
}

const LINE_WIDTH = 80;

/**
 * Run the `// →` statements of `code` (the source of `file`) and return the
 * source with every marker rewritten to its computed result. Returns `code`
 * unchanged when it has no markers.
 */
export async function evalExample(
  file: string,
  code: string,
  loader: Loader = load,
  watchDependency?: WatchDependency,
): Promise<string> {
  if (!code.includes(`// ${ARROW}`) && !code.includes(`//${ARROW}`)) {
    return code;
  }
  const { instrumented, markers } = instrument(file, code);
  if (markers.length === 0) return code;

  const hash = createHash('sha1')
    .update(instrumented)
    .digest('hex')
    .slice(0, 10);
  const id = `${file}?ck-eval=${hash}`;
  virtualModules.set(id, instrumented);
  let results: unknown[];
  try {
    const module = await loader(id, watchDependency);
    results = await Promise.all(module.__ckResults as unknown[]);
  } catch (error) {
    throw new Error(
      `Evaluating the \`// ${ARROW}\` results in ${file} failed: ${(error as Error).message}`,
      { cause: error },
    );
  } finally {
    virtualModules.delete(id);
  }

  let output = code;
  for (const marker of [...markers].reverse()) {
    const text = formatResult(results[marker.index]);
    let comment: string;
    if (marker.inline && marker.column + 5 + text.length <= LINE_WIDTH) {
      comment = `// ${ARROW} ${text}`;
    } else if (marker.inline) {
      // Too long for the statement's line: move it below.
      const lineStart = output.lastIndexOf('\n', marker.start) + 1;
      const indent = /^[ \t]*/.exec(output.slice(lineStart))![0];
      const before = output.slice(0, marker.start).trimEnd();
      output = `${before}\n${indent}// ${ARROW} ${text}${output.slice(marker.end)}`;
      continue;
    } else {
      comment = `// ${ARROW} ${text}`;
    }
    output = output.slice(0, marker.start) + comment + output.slice(marker.end);
  }
  return output;
}

/**
 * Hooks that give the evaluator the site's aliases and shut its server down
 * with the build. Registered by `highlightPlugin()`.
 */
export function evalLifecycle(): Pick<
  Plugin,
  'configResolved' | 'closeBundle' | 'configureServer'
> {
  return {
    configResolved(config: ResolvedConfig) {
      aliases = config.resolve.alias as Alias[];
      root = config.root;
      isServe = config.command === 'serve';
    },
    async closeBundle() {
      await closeEvalServer();
    },
    configureServer(server) {
      server.httpServer?.once('close', () => {
        void closeEvalServer();
      });
    },
  };
}
