/**
 * The generated API model, written by `scripts/api/normalize.mjs` from
 * TypeDoc's JSON. Hand-written so the site, the drift test and S5's map all
 * read one documented shape.
 *
 * Files (all under `src/generated/`, gitignored, rebuilt by `pnpm docs:api`):
 *
 * - `api.json`: {@link ApiModel}. Entries with their symbol summaries; the
 *   route registry projects it down (see `plugins/route-data.ts`).
 * - `api/entries/<entry>.json`: one {@link ApiEntry}, loaded by `/api/<entry>`
 *   and its category pages.
 * - `api/domains/<entry>/<domain>/<part>.json`: the full {@link ApiSymbol}s
 *   of one category, in display order, split into parts of bounded size
 *   (`0.json`, `1.json`, …) so no data chunk outgrows the bundle budget.
 *   Loaded by `/api/<entry>/<domain>`, which renders one row per symbol.
 *
 * Links are resolved at generation time: every `href` in the model points
 * at a page that exists, and a symbol's `href` is its row on the category
 * page, `/api/<entry>/<domain>#<Symbol>` (see {@link symbolHref}).
 */

/** Model version; bump when the shape changes incompatibly. */
export const API_MODEL_VERSION = 1;

export type SymbolKind =
  | 'function'
  | 'component'
  | 'class'
  | 'interface'
  | 'type'
  | 'const'
  | 'variable'
  | 'enum'
  | 'namespace';

/** Kinds that exist at runtime (as opposed to type-only exports). */
export const VALUE_KINDS: ReadonlySet<SymbolKind> = new Set([
  'function',
  'component',
  'class',
  'const',
  'variable',
  'enum',
  'namespace',
]);

export interface ApiModel {
  version: typeof API_MODEL_VERSION;
  /** Commit the source links point at. */
  commit: string;
  /** `https://github.com/<owner>/<repo>` */
  repository: string;
  /** Entry points in package order. */
  entries: ApiEntrySummary[];
}

/** An entry point as listed in `api.json` (no re-export list). */
export interface ApiEntrySummary {
  /** URL slug: `core`, `plane`, `interop`, `compute`, `hct`, `driver`, `react`. */
  slug: string;
  /** Display title, the import path (`@pbroom/color-kit`, `@pbroom/color-kit/plane`). */
  title: string;
  /** The specifier users write. */
  importPath: string;
  /** Other specifiers for the same files (`@pbroom/color-kit/core`). */
  aliases: string[];
  /** One line. */
  summary: string;
  /** Source entry file, relative to the repo root. */
  source: string;
  /** Symbols whose canonical home is this entry, in display order. */
  symbols: ApiSymbolSummary[];
  /** Domains in display order; every symbol belongs to exactly one. */
  domains: ApiDomain[];
  counts: { symbols: number; values: number; types: number; reexports: number };
}

/** `api/entries/<entry>.json`: the entry page. */
export interface ApiEntry extends ApiEntrySummary {
  /** Exports of this entry whose canonical page lives in another entry. */
  reexports: ApiReexport[];
}

export interface ApiDomain {
  /** From the source folder (`conversion`, `gamut`, `color-area`, …). */
  slug: string;
  title: string;
  /** Symbol names, in display order. */
  symbols: string[];
}

export interface ApiSymbolSummary {
  name: string;
  kind: SymbolKind;
  /** First sentence of the summary, plain text. */
  summary?: string;
  /** Domain slug. */
  domain: string;
  /** Present (possibly empty) when the symbol is deprecated. */
  deprecated?: string;
}

/** An export served by one entry whose page lives in another. */
export interface ApiReexport {
  name: string;
  kind: SymbolKind;
  summary?: string;
  /** Entry slug of the canonical row. */
  canonicalEntry: string;
  /** The canonical row, `/api/<entry>/<domain>#<Symbol>`. */
  href: string;
}

export interface ApiSource {
  /** Repo-relative path. */
  path: string;
  line: number;
  /** GitHub blob URL at {@link ApiModel.commit}. */
  url: string;
}

/** One symbol, as a row (and its expanded panel) on its category page. */
export interface ApiSymbol {
  name: string;
  kind: SymbolKind;
  /** Entry slug where this row lives (the canonical entry). */
  entry: string;
  /** Same as `entry`: the most specific entry exporting the declaration. */
  canonicalEntry: string;
  importPath: string;
  /** Other entries exporting the same declaration. */
  alsoFrom: Array<{ entry: string; importPath: string }>;
  domain: string;
  domainTitle: string;
  /** Present when deprecated: the reason, or `''`. */
  deprecated?: string;
  source?: ApiSource;
  comment: ApiComment;
  /** Functions, components, class constructors: one per overload. */
  signatures: ApiSignature[];
  /** Interfaces, classes, object types; component props. */
  members: ApiMember[];
  /** `extends` / `implements` clauses. */
  heritage: Array<{ relation: 'extends' | 'implements'; type: TypeRef }>;
  typeParameters: ApiTypeParameter[];
  /** Type aliases and variables: the declared type. */
  type?: TypeRef;
  /** Variables: the initializer as written, when short. */
  value?: string;
  /** Components: the props type's name, when `members` are its props. */
  propsType?: string;
}

export interface ApiSignature {
  typeParameters: ApiTypeParameter[];
  params: ApiParam[];
  returns: TypeRef;
  comment: ApiComment;
}

export interface ApiTypeParameter {
  name: string;
  constraint?: TypeRef;
  default?: TypeRef;
}

export interface ApiParam {
  name: string;
  type: TypeRef;
  optional: boolean;
  rest: boolean;
  /** Default as written in the source. */
  default?: string;
  description: RichText;
  /** Expanded fields of an inline object type (`options.gamut`). */
  children?: ApiParam[];
}

export interface ApiMember {
  name: string;
  kind: 'property' | 'method' | 'accessor' | 'constructor' | 'index';
  /** Index signatures retain their key name/type independently of the value. */
  indexParameter?: { name: string; type: TypeRef };
  type: TypeRef;
  optional: boolean;
  readonly: boolean;
  static: boolean;
  /** From `@defaultValue` / `@default`. */
  default?: string;
  description: RichText;
  deprecated?: string;
  /** Methods: their signatures. */
  signatures?: ApiSignature[];
}

/** JSDoc, parsed into blocks with resolved links. */
export interface ApiComment {
  summary: RichText;
  remarks: RichText;
  returns: RichText;
  examples: ApiExample[];
  throws: RichText[];
  see: RichText;
}

export interface ApiExample {
  caption?: string;
  lang: string;
  code: string;
  /** Build-time Shiki HTML (CSS-variables theme), for `<CodeBlock html>`. */
  html: string;
}

export type RichText = RichBlock[];

export type RichBlock =
  | { type: 'p'; children: RichInline[] }
  | { type: 'list'; ordered: boolean; items: RichInline[][] }
  | { type: 'code'; lang: string; code: string; html: string };

export type RichInline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'em'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string; code?: boolean };

/**
 * A type as declared, as a run of tokens. `ref` parts that name a
 * documented symbol carry its row in `href`, across entries.
 */
export interface TypeRef {
  /** Plain-text form, for width decisions and copy. */
  text: string;
  parts: TypePart[];
}

export interface TypePart {
  kind: 'keyword' | 'literal' | 'punct' | 'ref' | 'name' | 'param' | 'text';
  text: string;
  /** `ref` parts: row of the named symbol, `/api/<entry>/<domain>#<Symbol>`. */
  href?: string;
}

/**
 * The row of a symbol on its category page, case preserved:
 * `/api/core/conversion#toRgb`. The row's element id is the bare name.
 */
export function symbolHref(
  entry: string,
  domain: string,
  name: string,
): string {
  return `/api/${entry}/${domain}#${encodeURIComponent(name)}`;
}

/**
 * Ids inside a symbol's panel are prefixed with its name, so the many panels
 * of one category page never share an id: `toRgb-param-color`,
 * `Color-prop-hex`, `toRgb-examples`.
 */
export function panelAnchor(symbol: string, id: string): string {
  return `${symbol}-${id}`;
}

/** Anchor id of a parameter row; overloads after the first are numbered. */
export function paramAnchor(
  symbol: string,
  name: string,
  overload = 0,
): string {
  return panelAnchor(
    symbol,
    overload === 0 ? `param-${name}` : `param-${overload + 1}-${name}`,
  );
}

/** Anchor id of a member (property, method, prop) row. */
export function memberAnchor(symbol: string, name: string): string {
  return panelAnchor(symbol, `prop-${name}`);
}
