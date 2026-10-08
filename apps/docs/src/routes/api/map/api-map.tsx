import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useNavigate } from 'react-router';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { preloadApiHref } from '@/api/data';
import type { ApiEntry } from '@/api/model';
import { ApiLink } from '@/components/api/api-link';
import { prefetchHref } from '@/lib/prefetch';
import { CoverageLedger } from './coverage-ledger';
import { LegendMark, NodeMark } from './map-marks';
import {
  allGroupIds,
  buildTree,
  defaultExpanded,
  importPathOf,
  KIND_GROUPS,
  layoutTree,
  LABEL_OFFSET,
  type KindGroup,
  type LaidOutNode,
  type MapFilter,
  type MapLayout,
  type MapNode,
} from './map-model';
import { usePanZoom } from './use-pan-zoom';

const KIND_LABELS: Record<string, string> = {
  function: 'function',
  component: 'component',
  class: 'class',
  interface: 'interface',
  type: 'type',
  const: 'const',
  variable: 'variable',
  enum: 'enum',
  namespace: 'namespace',
};

function nodeAriaLabel(node: MapNode): string {
  if (node.children) {
    const what = node.type === 'reexports' ? 're-exports' : 'exports';
    return `${node.label}, ${node.count} ${what}`;
  }
  const kind = KIND_LABELS[node.kind ?? ''] ?? node.kind ?? 'symbol';
  return node.canonicalEntry
    ? `${node.label}, ${kind}, re-exported from ${importPathOf(node.canonicalEntry)}`
    : `${node.label}, ${kind}`;
}

/** The label with the find query's first match set apart. */
function Label({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <tspan className="map-node__match">
        {text.slice(at, at + query.length)}
      </tspan>
      {text.slice(at + query.length)}
    </>
  );
}

interface MapNodesProps {
  layout: MapLayout;
  activeId: string;
  query: string;
  onToggle: (id: string) => void;
  onActive: (id: string) => void;
  onHover: (id: string) => void;
  onNavigate: (event: ReactMouseEvent<Element>, href: string) => void;
}

/** Links and nodes. Kept apart from the transform so panning skips it. */
function MapNodes({
  layout,
  activeId,
  query,
  onToggle,
  onActive,
  onHover,
  onNavigate,
}: MapNodesProps) {
  return (
    <>
      <g className="map-links" aria-hidden="true">
        {layout.links.map((link) => (
          <path key={link.id} className="map-link" d={link.d} />
        ))}
      </g>
      <g className="map-nodes">
        {layout.nodes.map((point) => {
          const node = point.data;
          const group = node.children !== undefined;
          const open = point.children !== undefined;
          const common = {
            'data-node-id': node.id,
            role: 'treeitem',
            'aria-level': point.depth + 1,
            'aria-label': nodeAriaLabel(node),
            tabIndex: node.id === activeId ? 0 : -1,
            onFocus: () => onActive(node.id),
            onPointerEnter: () => onHover(node.id),
          } as const;
          const body = (
            <>
              <circle className="map-node__ring" r={8} />
              <NodeMark node={node} open={open} />
              <text className="map-node__label" x={LABEL_OFFSET} dy="0.32em">
                <Label text={node.label} query={group ? '' : query} />
                {group ? (
                  <tspan className="map-node__count" dx={6}>
                    {node.count}
                  </tspan>
                ) : null}
              </text>
            </>
          );
          return (
            <g
              key={node.id}
              className="map-node-pos"
              transform={`translate(${point.x},${point.y})`}
            >
              {group ? (
                <g
                  {...common}
                  className="map-node"
                  data-type={node.type}
                  aria-expanded={open}
                  onClick={() => {
                    onActive(node.id);
                    onToggle(node.id);
                  }}
                >
                  <circle className="map-node__hit" r={11} />
                  {body}
                </g>
              ) : (
                <a
                  {...common}
                  className="map-node"
                  data-type="symbol"
                  data-reexport={node.canonicalEntry ? '' : undefined}
                  data-deprecated={node.deprecated ? '' : undefined}
                  href={node.href}
                  onClick={(event) => onNavigate(event, node.href)}
                  onPointerEnter={() => {
                    onHover(node.id);
                    preloadApiHref(node.href);
                    prefetchHref(node.href);
                  }}
                >
                  <circle className="map-node__hit" r={9} />
                  {body}
                </a>
              )}
            </g>
          );
        })}
      </g>
    </>
  );
}

function pathTo(point: LaidOutNode): string {
  return point
    .ancestors()
    .reverse()
    .slice(1, -1)
    .map((a) => a.data.label)
    .join(' › ');
}

function Inspector({ point }: { point: LaidOutNode }) {
  const node = point.data;
  if (node.type === 'root') {
    return (
      <div className="map-inspector" data-type="root">
        <p className="map-inspector__lede">
          Open an entry point, then a domain, to reach its exports. Every node
          opens its reference page.
        </p>
      </div>
    );
  }
  if (node.children) {
    return (
      <div className="map-inspector" data-type={node.type}>
        <p className="map-inspector__head">
          <span
            className="map-inspector__name"
            data-mono={node.type === 'entry' || undefined}
          >
            {node.label}
          </span>
          <span className="map-inspector__meta">
            {pathTo(point.parent ?? point) || 'entry point'} · {node.count}{' '}
            {node.type === 'reexports' ? 're-exports' : 'exports'}
          </span>
        </p>
        {node.summary ? (
          <p className="map-inspector__summary">{node.summary}</p>
        ) : null}
        <ApiLink to={node.href} className="map-inspector__open">
          Open reference
        </ApiLink>
      </div>
    );
  }
  const typeOnly = node.kind === 'interface' || node.kind === 'type';
  const from = importPathOf(node.canonicalEntry ?? node.entry);
  return (
    <div className="map-inspector" data-type="symbol">
      <p className="map-inspector__head">
        <span className="map-inspector__name" data-mono="">
          {node.label}
        </span>
        <span className="map-inspector__meta">
          {node.kind} · {pathTo(point)}
          {node.deprecated ? ' · deprecated' : ''}
        </span>
      </p>
      {node.summary ? (
        <p className="map-inspector__summary">{node.summary}</p>
      ) : null}
      <code className="map-inspector__import">
        import {typeOnly ? 'type ' : ''}
        {'{ '}
        {node.label}
        {' }'} from &apos;{from}&apos;;
      </code>
      <ApiLink to={node.href} className="map-inspector__open">
        Open reference
      </ApiLink>
    </div>
  );
}

/**
 * The interactive API map: toolbar (find, entry, kinds), the tidy tree in
 * SVG with pan/zoom and tree keyboard navigation, a detail line for the
 * hovered or focused node, and the export ledger.
 */
export function ApiMap({ entries }: { entries: readonly ApiEntry[] }) {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const ids = useId();
  const [filter, setFilter] = useState<MapFilter>({
    entry: null,
    kinds: new Set<KindGroup>(),
    query: '',
    reexports: true,
  });
  const [expanded, setExpanded] =
    useState<ReadonlySet<string>>(defaultExpanded);
  const [activeId, setActiveId] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const panZoom = usePanZoom(svgRef);
  const { view } = panZoom;

  const query = filter.query.trim().toLowerCase();
  const tree = buildTree(entries, filter);
  const layout = layoutTree(tree, expanded);
  const byId = new Map(layout.nodes.map((point) => [point.data.id, point]));
  const active = byId.get(activeId) ?? layout.root;
  const shown = (hoveredId ? byId.get(hoveredId) : undefined) ?? active;

  let canonical = 0;
  let reexported = 0;
  const countLeaves = (node: MapNode) => {
    if (node.children) node.children.forEach(countLeaves);
    else if (node.canonicalEntry) reexported += 1;
    else canonical += 1;
  };
  countLeaves(tree);
  const filtered =
    filter.entry !== null || filter.kinds.size > 0 || query !== '';

  /** Apply a new filter; re-open what it shows and fit it in view. */
  const applyFilter = (next: MapFilter) => {
    setFilter(next);
    const nextTree = buildTree(entries, next);
    const nextQuery = next.query.trim();
    let nextExpanded: ReadonlySet<string>;
    if (nextQuery !== '') {
      nextExpanded = allGroupIds(nextTree);
    } else if (next.entry !== null) {
      nextExpanded = new Set(['', next.entry]);
    } else {
      nextExpanded = defaultExpanded();
    }
    setExpanded(nextExpanded);
    if (nextQuery !== '' || next.entry !== null) {
      panZoom.fit(layoutTree(nextTree, nextExpanded).bounds);
    } else {
      panZoom.reset();
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (id !== '') next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const focusNode = (point: LaidOutNode) => {
    setActiveId(point.data.id);
    setHoveredId(null);
    svgRef.current
      ?.querySelector<SVGElement>(
        `[data-node-id="${CSS.escape(point.data.id)}"]`,
      )
      ?.focus({ preventScroll: true });
    panZoom.reveal(point.x, point.y);
  };

  const onNavigate = (event: ReactMouseEvent<Element>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    void navigate(href);
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const order = layout.nodes;
    const index = order.indexOf(active);
    const node = active.data;
    const isGroup = node.children !== undefined;
    const isOpen = active.children !== undefined;
    switch (event.key) {
      case 'ArrowDown':
        focusNode(order[Math.min(order.length - 1, index + 1)]!);
        break;
      case 'ArrowUp':
        focusNode(order[Math.max(0, index - 1)]!);
        break;
      case 'Home':
        focusNode(order[0]!);
        break;
      case 'End':
        focusNode(order[order.length - 1]!);
        break;
      case 'ArrowRight':
        if (isGroup && !isOpen) toggle(node.id);
        else if (active.children) focusNode(active.children[0]!);
        break;
      case 'ArrowLeft':
        if (isGroup && isOpen && node.type !== 'root') toggle(node.id);
        else if (active.parent) focusNode(active.parent);
        break;
      case 'Enter':
        if (!isGroup) return; // The link follows itself.
        toggle(node.id);
        break;
      case ' ':
        if (isGroup) toggle(node.id);
        else void navigate(node.href);
        break;
      case '+':
      case '=':
        panZoom.zoomBy(1.25);
        break;
      case '-':
        panZoom.zoomBy(0.8);
        break;
      case '0':
        panZoom.fit(layout.bounds);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const showEntry = (slug: string) => {
    const next = new Set([...expanded, '', slug]);
    setExpanded(next);
    const point = layoutTree(tree, next).nodes.find(
      (candidate) => candidate.data.id === slug,
    );
    svgRef.current?.scrollIntoView({ block: 'nearest' });
    if (point) {
      setActiveId(slug);
      setHoveredId(null);
      svgRef.current
        ?.querySelector<SVGElement>(`[data-node-id="${CSS.escape(slug)}"]`)
        ?.focus({ preventScroll: true });
      panZoom.reveal(point.x, point.y, true);
    }
  };

  const expandAll = () => {
    const next = allGroupIds(tree);
    setExpanded(next);
    // Hundreds of rows: start readable at the top rather than fit them all.
    panZoom.fit(layoutTree(tree, next).bounds, { minZoom: 0.6 });
  };

  const collapse = () => {
    setExpanded(defaultExpanded());
    panZoom.reset();
  };

  const entryOptions = entries.map((entry) => entry.slug);

  return (
    <div className="api-map">
      <div className="api-map__toolbar" role="group" aria-label="Map filters">
        <div className="api-map__find">
          <label htmlFor={`${ids}-find`} className="api-map__label">
            Find
          </label>
          <input
            id={`${ids}-find`}
            className="field"
            type="search"
            placeholder="Export name"
            autoComplete="off"
            spellCheck={false}
            value={filter.query}
            onChange={(event) =>
              applyFilter({ ...filter, query: event.target.value })
            }
          />
        </div>
        <div className="api-map__entry">
          <label htmlFor={`${ids}-entry`} className="api-map__label">
            Entry
          </label>
          <select
            id={`${ids}-entry`}
            className="field"
            value={filter.entry ?? ''}
            onChange={(event) =>
              applyFilter({ ...filter, entry: event.target.value || null })
            }
          >
            <option value="">All entry points</option>
            {entryOptions.map((slug) => (
              <option key={slug} value={slug}>
                {importPathOf(slug)}
              </option>
            ))}
          </select>
        </div>
        <div
          className="api-map__kinds"
          role="group"
          aria-label="Kinds shown (all when none is pressed)"
        >
          {KIND_GROUPS.map((kind) => {
            const pressed = filter.kinds.has(kind.id);
            return (
              <button
                key={kind.id}
                type="button"
                className="api-map__chip"
                aria-pressed={pressed}
                onClick={() => {
                  const kinds = new Set(filter.kinds);
                  if (pressed) kinds.delete(kind.id);
                  else kinds.add(kind.id);
                  applyFilter({ ...filter, kinds });
                }}
              >
                <LegendMark group={kind.id} />
                {kind.label}
              </button>
            );
          })}
          <button
            type="button"
            className="api-map__chip"
            aria-pressed={filter.reexports}
            onClick={() =>
              applyFilter({ ...filter, reexports: !filter.reexports })
            }
          >
            <LegendMark group="function" reexport />
            Re-exports
          </button>
        </div>
      </div>

      <div className="api-map__frame">
        <svg
          ref={svgRef}
          className="api-map__canvas"
          role="tree"
          aria-label="color-kit API tree. Arrow keys move and open, Enter opens a page, plus and minus zoom."
          onKeyDown={onKeyDown}
          onPointerLeave={() => setHoveredId(null)}
          {...panZoom.handlers}
        >
          <svg x="0" y="50%" overflow="visible">
            <g
              className="api-map__viewport"
              data-pristine={view ? undefined : ''}
              style={
                view
                  ? {
                      transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                    }
                  : undefined
              }
            >
              <MapNodes
                layout={layout}
                activeId={active.data.id}
                query={query}
                onToggle={toggle}
                onActive={setActiveId}
                onHover={setHoveredId}
                onNavigate={onNavigate}
              />
            </g>
          </svg>
        </svg>
        <div className="api-map__controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => panZoom.zoomBy(1.25)}
          >
            <Plus aria-hidden="true" size={15} strokeWidth={1.75} />
            <span className="visually-hidden">Zoom in</span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => panZoom.zoomBy(0.8)}
          >
            <Minus aria-hidden="true" size={15} strokeWidth={1.75} />
            <span className="visually-hidden">Zoom out</span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => panZoom.fit(layout.bounds)}
          >
            <Maximize2 aria-hidden="true" size={13} strokeWidth={1.75} />
            <span className="visually-hidden">Fit to view</span>
          </button>
        </div>
        {tree.count === 0 ? (
          <p className="api-map__empty">
            Nothing matches these filters.{' '}
            <button
              type="button"
              className="api-map__text-button"
              onClick={() =>
                applyFilter({
                  entry: null,
                  kinds: new Set<KindGroup>(),
                  query: '',
                  reexports: true,
                })
              }
            >
              Clear filters
            </button>
          </p>
        ) : null}
        <p className="api-map__hint" aria-hidden="true">
          Drag to pan · ⌘/Ctrl + scroll or pinch to zoom
        </p>
      </div>

      <div className="api-map__status">
        <p role="status" className="api-map__count">
          {filtered
            ? `${canonical} ${canonical === 1 ? 'export' : 'exports'}${
                reexported ? ` and ${reexported} re-exports` : ''
              } match`
            : `${canonical} exports, ${reexported} re-exports`}
        </p>
        <div className="api-map__actions">
          <button
            type="button"
            className="api-map__text-button"
            onClick={expandAll}
          >
            Expand all
          </button>
          <button
            type="button"
            className="api-map__text-button"
            onClick={collapse}
          >
            Collapse
          </button>
        </div>
      </div>

      <Inspector point={shown} />

      <ul className="api-map__legend" aria-label="Legend">
        {KIND_GROUPS.map((kind) => (
          <li key={kind.id}>
            <LegendMark group={kind.id} />
            {kind.label}
          </li>
        ))}
        <li>
          <LegendMark group="function" reexport />
          Re-export (page elsewhere)
        </li>
        <li>
          <LegendMark ring="closed" />
          Closed group
        </li>
        <li>
          <LegendMark ring="open" />
          Open group
        </li>
      </ul>

      <CoverageLedger entries={entries} onShow={showEntry} />
    </div>
  );
}
