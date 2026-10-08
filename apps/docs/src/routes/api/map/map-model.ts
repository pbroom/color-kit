import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { ApiEntry, SymbolKind } from '@/api/model';
import { symbolHref } from '@/api/model';

/**
 * The API map's data model: the generated entries (S2's
 * `generated/api/entries/*.json`) folded into one tree, root → entry point
 * → domain → symbol, plus the per-entry export ledger. Pure functions only,
 * so the prerender and the hydrating client compute identical layouts.
 */

/** Filter chips: kinds grouped the way readers look for them. */
export type KindGroup = 'function' | 'component' | 'class' | 'value' | 'type';

export const KIND_GROUPS: ReadonlyArray<{
  id: KindGroup;
  label: string;
  short: string;
}> = [
  { id: 'function', label: 'Functions', short: 'Fn' },
  { id: 'component', label: 'Components', short: 'Comp' },
  { id: 'class', label: 'Classes', short: 'Class' },
  { id: 'value', label: 'Constants', short: 'Const' },
  { id: 'type', label: 'Types', short: 'Type' },
];

export function kindGroup(kind: string): KindGroup {
  switch (kind as SymbolKind) {
    case 'function':
      return 'function';
    case 'component':
      return 'component';
    case 'class':
      return 'class';
    case 'interface':
    case 'type':
      return 'type';
    default:
      return 'value';
  }
}

export type MapNodeType = 'root' | 'entry' | 'domain' | 'reexports' | 'symbol';

export interface MapNode {
  /** Stable path id: `react`, `react/hooks`, `react/hooks/useColor`. */
  id: string;
  type: MapNodeType;
  label: string;
  /** Reference page this node opens. */
  href: string;
  /** Entry slug the node belongs to (`''` for the root). */
  entry: string;
  /** Symbols only. */
  kind?: SymbolKind;
  summary?: string;
  deprecated?: boolean;
  /** Re-export leaves: the entry whose page documents the symbol. */
  canonicalEntry?: string;
  /** Groups: symbols beneath, after filtering. */
  count: number;
  children?: MapNode[];
}

export interface MapFilter {
  /** Entry slug, or `null` for every entry. */
  entry: string | null;
  /** Kind groups shown; every group when empty. */
  kinds: ReadonlySet<KindGroup>;
  /** Case-insensitive name substring; `''` for none. */
  query: string;
  /** Include each entry's re-exports group. */
  reexports: boolean;
}

export const DEFAULT_FILTER: MapFilter = {
  entry: null,
  kinds: new Set(),
  query: '',
  reexports: true,
};

export function importPathOf(entry: string): string {
  return entry === 'core' ? 'color-kit' : `color-kit/${entry}`;
}

function group(
  node: Omit<MapNode, 'count'>,
  children: MapNode[],
): MapNode | null {
  if (children.length === 0) return null;
  return {
    ...node,
    children,
    count: children.reduce(
      (sum, child) => sum + (child.children ? child.count : 1),
      0,
    ),
  };
}

/** Build the filtered tree. Empty groups are dropped; the root always stays. */
export function buildTree(
  entries: readonly ApiEntry[],
  filter: MapFilter,
): MapNode {
  const query = filter.query.trim().toLowerCase();
  const keep = (name: string, kind: string) =>
    (filter.kinds.size === 0 || filter.kinds.has(kindGroup(kind))) &&
    (query === '' || name.toLowerCase().includes(query));

  const entryNodes = entries
    .filter((entry) => filter.entry === null || entry.slug === filter.entry)
    .map((entry) => {
      const bySymbol = new Map(entry.symbols.map((s) => [s.name, s]));
      const domains = entry.domains.map((domain) =>
        group(
          {
            id: `${entry.slug}/${domain.slug}`,
            type: 'domain',
            label: domain.title,
            href: `/api/${entry.slug}#domain-${domain.slug}`,
            entry: entry.slug,
          },
          domain.symbols.flatMap((name): MapNode[] => {
            const symbol = bySymbol.get(name);
            if (!symbol || !keep(symbol.name, symbol.kind)) return [];
            return [
              {
                id: `${entry.slug}/${domain.slug}/${symbol.name}`,
                type: 'symbol',
                label: symbol.name,
                href: symbolHref(entry.slug, symbol.name),
                entry: entry.slug,
                kind: symbol.kind,
                summary: symbol.summary,
                deprecated: symbol.deprecated !== undefined,
                count: 1,
              },
            ];
          }),
        ),
      );
      const reexports = filter.reexports
        ? group(
            {
              id: `${entry.slug}/~reexports`,
              type: 'reexports',
              label: 'Re-exported',
              href: `/api/${entry.slug}#reexports`,
              entry: entry.slug,
            },
            entry.reexports
              .filter((item) => keep(item.name, item.kind))
              .map((item) => ({
                id: `${entry.slug}/~reexports/${item.name}`,
                type: 'symbol' as const,
                label: item.name,
                href: item.href,
                entry: entry.slug,
                kind: item.kind,
                summary: item.summary,
                canonicalEntry: item.canonicalEntry,
                count: 1,
              })),
          )
        : null;
      return group(
        {
          id: entry.slug,
          type: 'entry',
          label: entry.importPath,
          href: `/api/${entry.slug}`,
          entry: entry.slug,
          summary: entry.summary,
        },
        [...domains, reexports].filter((node): node is MapNode => !!node),
      );
    })
    .filter((node): node is MapNode => !!node);

  return (
    group(
      {
        id: '',
        type: 'root',
        label: 'color-kit',
        href: '/api',
        entry: '',
      },
      entryNodes,
    ) ?? {
      id: '',
      type: 'root',
      label: 'color-kit',
      href: '/api',
      entry: '',
      count: 0,
      children: [],
    }
  );
}

/** Root plus entry points open: the prerendered first view. */
export function defaultExpanded(): Set<string> {
  return new Set(['']);
}

/** Every group that holds a node (used for "expand all" and find). */
export function allGroupIds(root: MapNode): Set<string> {
  const ids = new Set<string>();
  const walk = (node: MapNode) => {
    if (!node.children) return;
    ids.add(node.id);
    node.children.forEach(walk);
  };
  walk(root);
  return ids;
}

export type LaidOutNode = HierarchyPointNode<MapNode>;

export interface MapLayout {
  root: LaidOutNode;
  /** Visible nodes in tree (depth-first) order: the keyboard order. */
  nodes: LaidOutNode[];
  /** One cubic per visible edge, from the parent's label end to the child. */
  links: Array<{ id: string; d: string }>;
  /** Bounds in layout units (x across, y down) for fitting the view. */
  bounds: { left: number; right: number; top: number; bottom: number };
}

/** Vertical distance between sibling rows, in px at zoom 1. */
export const ROW_GAP = 22;
/** Space between the widest label of a column and the next column. */
const COLUMN_GAP = 44;
/** Label starts this far right of its node's mark. */
export const LABEL_OFFSET = 10;

/**
 * Estimated drawn label width (px at zoom 1): names in JetBrains Mono at
 * 12px (0.6em advance), domain titles in Inter at 12.5px, counts in mono at
 * 11px. An estimate keeps layout pure (identical on server and client); the
 * column gap absorbs the error.
 */
export function labelWidth(node: MapNode): number {
  const sans = node.type === 'domain' || node.type === 'reexports';
  const name = node.label.length * (sans ? 7 : 7.2);
  const count = node.children ? 6 + String(node.count).length * 6.6 : 0;
  return LABEL_OFFSET + name + count;
}

/**
 * Tidy-tree layout of the visible part of `root`: groups in `expanded` show
 * their children. d3's tidy tree places rows; columns are as wide as their
 * longest visible label, so every label reads left to right and links leave
 * from the end of the parent's label. Coordinates are screen-oriented: `x`
 * grows right with depth, `y` grows down.
 */
export function layoutTree(
  root: MapNode,
  expanded: ReadonlySet<string>,
): MapLayout {
  const h = hierarchy(root, (node) =>
    node.children && expanded.has(node.id) ? node.children : null,
  );
  const laidOut = tree<MapNode>()
    .nodeSize([ROW_GAP, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.4))(h);
  const nodes: LaidOutNode[] = [];
  laidOut.eachBefore((node) => nodes.push(node));

  const columnWidth: number[] = [];
  for (const node of nodes) {
    columnWidth[node.depth] = Math.max(
      columnWidth[node.depth] ?? 0,
      labelWidth(node.data),
    );
  }
  const columnX = [0];
  for (let depth = 1; depth < columnWidth.length; depth += 1) {
    columnX[depth] = columnX[depth - 1]! + columnWidth[depth - 1]! + COLUMN_GAP;
  }

  let right = 0;
  let top = 0;
  let bottom = 0;
  for (const node of nodes) {
    // d3 lays trees out top-down (x across); rows become y, depth becomes x.
    node.y = node.x;
    node.x = columnX[node.depth]!;
    right = Math.max(right, node.x + labelWidth(node.data));
    top = Math.min(top, node.y - ROW_GAP / 2);
    bottom = Math.max(bottom, node.y + ROW_GAP / 2);
  }

  const links = laidOut.links().map(({ source, target }) => {
    const x0 = source.x + labelWidth(source.data) + 6;
    const x1 = target.x - 7;
    const mid = x0 + (x1 - x0) / 2;
    return {
      id: target.data.id,
      d: `M${x0},${source.y}C${mid},${source.y} ${mid},${target.y} ${x1},${target.y}`,
    };
  });

  return {
    root: laidOut,
    nodes,
    links,
    bounds: { left: -12, right, top, bottom },
  };
}

export interface LedgerRow {
  entry: string;
  importPath: string;
  summary: string;
  domains: number;
  kinds: Record<KindGroup, number>;
  exports: number;
  documented: number;
  deprecated: number;
  reexports: number;
}

/** Per-entry export ledger, in package order. */
export function ledgerRows(entries: readonly ApiEntry[]): LedgerRow[] {
  return entries.map((entry) => {
    const kinds: Record<KindGroup, number> = {
      function: 0,
      component: 0,
      class: 0,
      value: 0,
      type: 0,
    };
    let documented = 0;
    let deprecated = 0;
    for (const symbol of entry.symbols) {
      kinds[kindGroup(symbol.kind)] += 1;
      if (symbol.summary) documented += 1;
      if (symbol.deprecated !== undefined) deprecated += 1;
    }
    return {
      entry: entry.slug,
      importPath: entry.importPath,
      summary: entry.summary,
      domains: entry.domains.length,
      kinds,
      exports: entry.symbols.length,
      documented,
      deprecated,
      reexports: entry.reexports.length,
    };
  });
}

/** Column totals across entries. */
export function ledgerTotals(rows: readonly LedgerRow[]): LedgerRow {
  const total: LedgerRow = {
    entry: '',
    importPath: 'All entry points',
    summary: '',
    domains: 0,
    kinds: { function: 0, component: 0, class: 0, value: 0, type: 0 },
    exports: 0,
    documented: 0,
    deprecated: 0,
    reexports: 0,
  };
  for (const row of rows) {
    total.domains += row.domains;
    total.exports += row.exports;
    total.documented += row.documented;
    total.deprecated += row.deprecated;
    total.reexports += row.reexports;
    for (const { id } of KIND_GROUPS) total.kinds[id] += row.kinds[id];
  }
  return total;
}
