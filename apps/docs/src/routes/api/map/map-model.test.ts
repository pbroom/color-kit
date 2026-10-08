import { describe, expect, it } from 'vitest';
import type { ApiEntry } from '@/api/model';
import {
  allGroupIds,
  buildTree,
  DEFAULT_FILTER,
  defaultExpanded,
  layoutTree,
  ledgerRows,
  ledgerTotals,
  type MapFilter,
  type MapNode,
} from './map-model';

function entry(
  slug: string,
  symbols: Array<[string, ApiEntry['symbols'][number]['kind'], string]>,
  reexports: ApiEntry['reexports'] = [],
): ApiEntry {
  const domains = [...new Set(symbols.map(([, , domain]) => domain))];
  return {
    slug,
    title: slug,
    importPath: slug === 'core' ? 'color-kit' : `color-kit/${slug}`,
    aliases: [],
    summary: `${slug} summary`,
    source: `packages/${slug}/src/index.ts`,
    symbols: symbols.map(([name, kind, domain]) => ({
      name,
      kind,
      domain,
      summary: name === 'undocumented' ? undefined : `${name}.`,
    })),
    domains: domains.map((slugName) => ({
      slug: slugName,
      title: slugName,
      symbols: symbols.filter(([, , d]) => d === slugName).map(([n]) => n),
    })),
    counts: { symbols: symbols.length, values: 0, types: 0, reexports: 0 },
    reexports,
  };
}

const ENTRIES: ApiEntry[] = [
  entry(
    'core',
    [
      ['parse', 'function', 'conversion'],
      ['Color', 'interface', 'types'],
      ['undocumented', 'const', 'conversion'],
    ],
    [
      {
        name: 'definePlane',
        kind: 'function',
        canonicalEntry: 'plane',
        href: '/api/plane/definePlane',
      },
    ],
  ),
  entry('plane', [
    ['definePlane', 'function', 'compile'],
    ['PlaneQueryCache', 'class', 'queries'],
  ]),
];

const leaves = (node: MapNode): MapNode[] =>
  node.children ? node.children.flatMap(leaves) : [node];

describe('API map model', () => {
  it('builds root → entry → domain → symbol, re-exports grouped apart', () => {
    const tree = buildTree(ENTRIES, DEFAULT_FILTER);
    expect(tree.children!.map((node) => node.label)).toEqual([
      'color-kit',
      'color-kit/plane',
    ]);
    expect(tree.count).toBe(6);
    const core = tree.children![0]!;
    expect(core.children!.map((node) => node.type)).toEqual([
      'domain',
      'domain',
      'reexports',
    ]);
    const parse = leaves(core).find((node) => node.label === 'parse')!;
    expect(parse.href).toBe('/api/core/parse');
    const alias = leaves(core).find((node) => node.canonicalEntry)!;
    expect(alias.href).toBe('/api/plane/definePlane');
  });

  it('filters by entry, kind and name', () => {
    const only = (filter: Partial<MapFilter>) =>
      leaves(buildTree(ENTRIES, { ...DEFAULT_FILTER, ...filter }))
        .filter((node) => node.type === 'symbol')
        .map((node) => node.label);
    expect(only({ entry: 'plane' })).toEqual([
      'definePlane',
      'PlaneQueryCache',
    ]);
    expect(only({ kinds: new Set(['type']) })).toEqual(['Color']);
    expect(only({ query: 'PLANE', reexports: false })).toEqual([
      'definePlane',
      'PlaneQueryCache',
    ]);
    expect(buildTree(ENTRIES, { ...DEFAULT_FILTER, query: 'zzz' }).count).toBe(
      0,
    );
  });

  it('lays out the collapsed first view and opens every group', () => {
    const tree = buildTree(ENTRIES, DEFAULT_FILTER);
    const first = layoutTree(tree, defaultExpanded());
    expect(first.nodes.map((node) => node.data.id)).toEqual([
      '',
      'core',
      'plane',
    ]);
    expect(first.links).toHaveLength(2);
    const [root, core] = first.nodes;
    expect(core!.x).toBeGreaterThan(root!.x);

    const open = layoutTree(tree, allGroupIds(tree));
    expect(open.nodes).toHaveLength(1 + 2 + 5 + 6);
    // Depth-first: a group comes right before its first child.
    const ids = open.nodes.map((node) => node.data.id);
    expect(ids.indexOf('core/conversion') + 1).toBe(
      ids.indexOf('core/conversion/parse'),
    );
    expect(open.bounds.bottom).toBeGreaterThan(open.bounds.top);
  });

  it('counts exports per entry for the ledger', () => {
    const rows = ledgerRows(ENTRIES);
    expect(rows[0]).toMatchObject({
      importPath: 'color-kit',
      domains: 2,
      exports: 3,
      documented: 2,
      reexports: 1,
      kinds: { function: 1, type: 1, value: 1, component: 0, class: 0 },
    });
    expect(ledgerTotals(rows)).toMatchObject({
      exports: 5,
      reexports: 1,
      kinds: { function: 2, class: 1 },
    });
  });
});
