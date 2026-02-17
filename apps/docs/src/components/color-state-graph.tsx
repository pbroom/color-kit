/**
 * Graph data model and interactive SVG for the Color state machine visualization.
 * Columns: 0 = inputs, 1 = actions, 2 = core state, 3 = computations, 4 = outputs.
 */

import {
  useMemo,
  useRef,
  useEffect,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { Color } from '@color-kit/core';
import {
  ColorProvider,
  useColorContext,
  ColorArea,
  ColorSlider,
  Background,
  ColorPlane,
  Layer,
  GamutBoundaryLayer,
  Thumb,
} from '@color-kit/react';
import type { UseColorReturn } from '@color-kit/react';

export type NodeType = 'input' | 'action' | 'state' | 'computation' | 'output';

export type NodeId = string;

export interface GraphNode {
  id: NodeId;
  type: NodeType;
  label: string;
  column: number;
  /** For state/output nodes: key path into ColorState or useColor return for live value */
  stateKey?: string;
  /** For output nodes that represent a color: show swatch */
  showSwatch?: boolean;
}

export interface GraphEdge {
  from: NodeId;
  to: NodeId;
  /** Group for cascade highlighting (e.g. 'setRequested' cascade) */
  cascadeGroup?: string;
}

/** Input triggers that can light up from ColorUpdateEvent.interaction or meta.source */
export const INPUT_NODE_IDS = [
  'input-pointer',
  'input-keyboard',
  'input-text-input',
  'input-programmatic',
  'input-gamut-toggle',
  'input-view-toggle',
] as const;

export const GRAPH_NODES: GraphNode[] = [
  // Column 0: Inputs
  { id: 'input-pointer', type: 'input', label: 'pointer', column: 0 },
  { id: 'input-keyboard', type: 'input', label: 'keyboard', column: 0 },
  { id: 'input-text-input', type: 'input', label: 'text-input', column: 0 },
  { id: 'input-programmatic', type: 'input', label: 'programmatic', column: 0 },
  { id: 'input-gamut-toggle', type: 'input', label: 'gamut toggle', column: 0 },
  { id: 'input-view-toggle', type: 'input', label: 'view toggle', column: 0 },
  // Column 1: Actions
  {
    id: 'action-setRequested',
    type: 'action',
    label: 'setRequested',
    column: 1,
  },
  { id: 'action-setChannel', type: 'action', label: 'setChannel', column: 1 },
  {
    id: 'action-setFromString',
    type: 'action',
    label: 'setFromString',
    column: 1,
  },
  { id: 'action-setFromRgb', type: 'action', label: 'setFromRgb', column: 1 },
  { id: 'action-setFromHsl', type: 'action', label: 'setFromHsl', column: 1 },
  { id: 'action-setFromHsv', type: 'action', label: 'setFromHsv', column: 1 },
  {
    id: 'action-setActiveGamut',
    type: 'action',
    label: 'setActiveGamut',
    column: 1,
  },
  {
    id: 'action-setActiveView',
    type: 'action',
    label: 'setActiveView',
    column: 1,
  },
  // Column 2: Core State
  {
    id: 'state-requested',
    type: 'state',
    label: 'requested',
    column: 2,
    stateKey: 'requested',
  },
  {
    id: 'state-activeGamut',
    type: 'state',
    label: 'activeGamut',
    column: 2,
    stateKey: 'activeGamut',
  },
  {
    id: 'state-activeView',
    type: 'state',
    label: 'activeView',
    column: 2,
    stateKey: 'activeView',
  },
  {
    id: 'state-meta-source',
    type: 'state',
    label: 'meta.source',
    column: 2,
    stateKey: 'meta.source',
  },
  // Column 3: Computations
  {
    id: 'comp-mapDisplayedColors',
    type: 'computation',
    label: 'mapDisplayedColors',
    column: 3,
  },
  {
    id: 'comp-inSrgbGamut',
    type: 'computation',
    label: 'inSrgbGamut',
    column: 3,
  },
  { id: 'comp-inP3Gamut', type: 'computation', label: 'inP3Gamut', column: 3 },
  {
    id: 'comp-getActiveDisplayedColor',
    type: 'computation',
    label: 'getActiveDisplayedColor',
    column: 3,
  },
  // Column 4: Outputs
  {
    id: 'out-displayed-srgb',
    type: 'output',
    label: 'displayed.srgb',
    column: 4,
    stateKey: 'displayedSrgb',
    showSwatch: true,
  },
  {
    id: 'out-displayed-p3',
    type: 'output',
    label: 'displayed.p3',
    column: 4,
    stateKey: 'displayedP3',
    showSwatch: true,
  },
  {
    id: 'out-displayed',
    type: 'output',
    label: 'displayed',
    column: 4,
    stateKey: 'displayed',
    showSwatch: true,
  },
  { id: 'out-hex', type: 'output', label: 'hex', column: 4, stateKey: 'hex' },
  { id: 'out-rgb', type: 'output', label: 'rgb', column: 4, stateKey: 'rgb' },
  { id: 'out-hsl', type: 'output', label: 'hsl', column: 4, stateKey: 'hsl' },
  { id: 'out-hsv', type: 'output', label: 'hsv', column: 4, stateKey: 'hsv' },
  {
    id: 'out-oklch',
    type: 'output',
    label: 'oklch',
    column: 4,
    stateKey: 'oklch',
  },
  {
    id: 'out-meta-oog-srgb',
    type: 'output',
    label: 'meta.outOfGamut.srgb',
    column: 4,
    stateKey: 'meta.outOfGamut.srgb',
  },
  {
    id: 'out-meta-oog-p3',
    type: 'output',
    label: 'meta.outOfGamut.p3',
    column: 4,
    stateKey: 'meta.outOfGamut.p3',
  },
];

export const GRAPH_EDGES: GraphEdge[] = [
  // Inputs -> Actions (which input triggers which action)
  {
    from: 'input-pointer',
    to: 'action-setRequested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-keyboard',
    to: 'action-setChannel',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-keyboard',
    to: 'action-setRequested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-text-input',
    to: 'action-setFromString',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-text-input',
    to: 'action-setChannel',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-programmatic',
    to: 'action-setRequested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-programmatic',
    to: 'action-setChannel',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-programmatic',
    to: 'action-setFromString',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-programmatic',
    to: 'action-setFromRgb',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-programmatic',
    to: 'action-setFromHsl',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-programmatic',
    to: 'action-setFromHsv',
    cascadeGroup: 'color-change',
  },
  {
    from: 'input-gamut-toggle',
    to: 'action-setActiveGamut',
    cascadeGroup: 'gamut-change',
  },
  {
    from: 'input-view-toggle',
    to: 'action-setActiveView',
    cascadeGroup: 'view-change',
  },
  // Actions -> State
  {
    from: 'action-setRequested',
    to: 'state-requested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setChannel',
    to: 'state-requested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromString',
    to: 'state-requested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromRgb',
    to: 'state-requested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromHsl',
    to: 'state-requested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromHsv',
    to: 'state-requested',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setRequested',
    to: 'state-meta-source',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setChannel',
    to: 'state-meta-source',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromString',
    to: 'state-meta-source',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromRgb',
    to: 'state-meta-source',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromHsl',
    to: 'state-meta-source',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setFromHsv',
    to: 'state-meta-source',
    cascadeGroup: 'color-change',
  },
  {
    from: 'action-setActiveGamut',
    to: 'state-activeGamut',
    cascadeGroup: 'gamut-change',
  },
  {
    from: 'action-setActiveGamut',
    to: 'state-meta-source',
    cascadeGroup: 'gamut-change',
  },
  {
    from: 'action-setActiveView',
    to: 'state-activeView',
    cascadeGroup: 'view-change',
  },
  {
    from: 'action-setActiveView',
    to: 'state-meta-source',
    cascadeGroup: 'view-change',
  },
  // State -> Computations
  {
    from: 'state-requested',
    to: 'comp-mapDisplayedColors',
    cascadeGroup: 'color-change',
  },
  {
    from: 'state-requested',
    to: 'comp-inSrgbGamut',
    cascadeGroup: 'color-change',
  },
  {
    from: 'state-requested',
    to: 'comp-inP3Gamut',
    cascadeGroup: 'color-change',
  },
  {
    from: 'state-activeGamut',
    to: 'comp-getActiveDisplayedColor',
    cascadeGroup: 'gamut-change',
  },
  // Computations -> Outputs
  {
    from: 'comp-mapDisplayedColors',
    to: 'out-displayed-srgb',
    cascadeGroup: 'color-change',
  },
  {
    from: 'comp-mapDisplayedColors',
    to: 'out-displayed-p3',
    cascadeGroup: 'color-change',
  },
  {
    from: 'comp-mapDisplayedColors',
    to: 'out-meta-oog-srgb',
    cascadeGroup: 'color-change',
  },
  {
    from: 'comp-mapDisplayedColors',
    to: 'out-meta-oog-p3',
    cascadeGroup: 'color-change',
  },
  {
    from: 'comp-getActiveDisplayedColor',
    to: 'out-displayed',
    cascadeGroup: 'gamut-change',
  },
  {
    from: 'comp-getActiveDisplayedColor',
    to: 'out-displayed',
    cascadeGroup: 'color-change',
  },
  { from: 'state-requested', to: 'out-hex', cascadeGroup: 'color-change' },
  { from: 'state-requested', to: 'out-rgb', cascadeGroup: 'color-change' },
  { from: 'state-requested', to: 'out-hsl', cascadeGroup: 'color-change' },
  { from: 'state-requested', to: 'out-hsv', cascadeGroup: 'color-change' },
  { from: 'state-requested', to: 'out-oklch', cascadeGroup: 'color-change' },
];

// --- Layout engine ---

const PADDING = 24;
const COL_WIDTH = 150;
const ROW_GAP = 12;

const NODE_SIZES: Record<NodeType, { width: number; height: number }> = {
  input: { width: 76, height: 26 },
  action: { width: 118, height: 28 },
  state: { width: 130, height: 44 },
  computation: { width: 160, height: 28 },
  output: { width: 130, height: 36 },
};

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgePath {
  from: NodeId;
  to: NodeId;
  d: string;
  cascadeGroup?: string;
}

function layoutGraph(): {
  nodes: PositionedNode[];
  edges: EdgePath[];
  width: number;
  height: number;
} {
  const columns: GraphNode[][] = [];
  for (let c = 0; c <= 4; c++) {
    columns[c] = GRAPH_NODES.filter((n) => n.column === c).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }

  let maxHeight = 0;
  const positioned: PositionedNode[] = [];

  for (let col = 0; col < columns.length; col++) {
    const list = columns[col];
    const nodeHeight = Math.max(
      ...list.map((n) => NODE_SIZES[n.type].height),
      28,
    );
    let y = PADDING;
    for (const node of list) {
      const size = NODE_SIZES[node.type];
      const x = PADDING + col * COL_WIDTH + (COL_WIDTH - size.width) / 2;
      positioned.push({
        ...node,
        x,
        y,
        width: size.width,
        height: size.height,
      });
      y += nodeHeight + ROW_GAP;
    }
    maxHeight = Math.max(maxHeight, y - ROW_GAP);
  }

  const totalWidth = PADDING * 2 + 5 * COL_WIDTH;
  const totalHeight = maxHeight + PADDING * 2;

  const nodeById = new Map<NodeId, PositionedNode>();
  for (const n of positioned) nodeById.set(n.id, n);

  const edges: EdgePath[] = GRAPH_EDGES.map((e) => {
    const fromN = nodeById.get(e.from);
    const toN = nodeById.get(e.to);
    if (!fromN || !toN)
      return { from: e.from, to: e.to, d: '', cascadeGroup: e.cascadeGroup };
    const x1 = fromN.x + fromN.width;
    const y1 = fromN.y + fromN.height / 2;
    const x2 = toN.x;
    const y2 = toN.y + toN.height / 2;
    const cpOffset = Math.min(50, (x2 - x1) * 0.4);
    const d = `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
    return { from: e.from, to: e.to, d, cascadeGroup: e.cascadeGroup };
  });

  return { nodes: positioned, edges, width: totalWidth, height: totalHeight };
}

// --- Live value formatting ---

function formatColor(c: Color): string {
  return `L ${c.l.toFixed(2)} C ${c.c.toFixed(2)} H ${Math.round(c.h)}`;
}

function getLiveValue(stateKey: string, api: UseColorReturn): string {
  switch (stateKey) {
    case 'requested':
      return formatColor(api.requested);
    case 'activeGamut':
      return api.activeGamut;
    case 'activeView':
      return api.activeView;
    case 'meta.source':
      return api.state.meta.source;
    case 'displayedSrgb':
      return formatColor(api.displayedSrgb);
    case 'displayedP3':
      return formatColor(api.displayedP3);
    case 'displayed':
      return formatColor(api.displayed);
    case 'hex':
      return api.hex;
    case 'rgb':
      return `rgb(${api.rgb.r},${api.rgb.g},${api.rgb.b})`;
    case 'hsl':
      return `hsl(${Math.round(api.hsl.h)},${Math.round(api.hsl.s * 100)}%,${Math.round(api.hsl.l * 100)}%)`;
    case 'hsv':
      return `h ${Math.round(api.hsv.h)} s ${(api.hsv.s * 100).toFixed(0)}% v ${(api.hsv.v * 100).toFixed(0)}%`;
    case 'oklch':
      return `L ${api.oklch.l.toFixed(2)} C ${api.oklch.c.toFixed(2)} H ${Math.round(api.oklch.h)}`;
    case 'meta.outOfGamut.srgb':
      return String(api.state.meta.outOfGamut.srgb);
    case 'meta.outOfGamut.p3':
      return String(api.state.meta.outOfGamut.p3);
    default:
      return '—';
  }
}

function getCssForSwatch(stateKey: string, api: UseColorReturn): string {
  switch (stateKey) {
    case 'requested':
      return api.requestedCss('hex') ?? 'transparent';
    case 'displayedSrgb':
      return api.displayedCss('hex') ?? 'transparent';
    case 'displayedP3':
      return api.displayedCss('p3') ?? api.displayedCss('hex') ?? 'transparent';
    case 'displayed':
      return api.displayedCss() ?? 'transparent';
    default:
      return 'transparent';
  }
}

type ColorInteraction = 'pointer' | 'keyboard' | 'text-input' | 'programmatic';

function interactionToInputNode(interaction: ColorInteraction): NodeId {
  switch (interaction) {
    case 'pointer':
      return 'input-pointer';
    case 'keyboard':
      return 'input-keyboard';
    case 'text-input':
      return 'input-text-input';
    case 'programmatic':
      return 'input-programmatic';
    default:
      return 'input-programmatic';
  }
}

// --- Node renderers (SVG) ---

const RX = 6;
const RY = 6;

function NodeShape({
  node,
  highlighted,
  children,
}: {
  node: PositionedNode;
  highlighted: boolean;
  children: ReactNode;
}) {
  const { x, y, width, height, type } = node;
  const isPill = type === 'input' || type === 'computation';
  const r = isPill ? height / 2 : RX;
  const fill =
    type === 'input'
      ? 'var(--color-surface-ghost-2)'
      : type === 'action'
        ? 'var(--color-surface-raised)'
        : type === 'state'
          ? 'var(--color-accent-soft)'
          : type === 'computation'
            ? 'var(--color-surface-ghost-3)'
            : 'var(--color-surface-ghost-2)';
  const stroke = highlighted ? 'var(--color-accent)' : 'var(--color-border)';
  const strokeWidth = highlighted ? 2 : 1;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={r}
        ry={isPill ? height / 2 : RY}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={{ transition: 'stroke 0.15s ease, stroke-width 0.15s ease' }}
      />
      {children}
    </g>
  );
}

function GraphNodeContent({
  node,
  api,
}: {
  node: PositionedNode;
  api: UseColorReturn | null;
}) {
  const { x, y, width, height, type, label, stateKey, showSwatch } = node;
  const hasLiveValue = stateKey && api;
  const liveValue = hasLiveValue ? getLiveValue(stateKey, api) : '';
  const swatchCss = showSwatch && api ? getCssForSwatch(stateKey!, api) : null;

  const labelY =
    type === 'state' || (type === 'output' && hasLiveValue)
      ? y + 14
      : y + height / 2;
  const fontSize = type === 'input' || type === 'computation' ? 11 : 12;
  const fontFamily =
    type === 'action' ? 'var(--font-mono)' : 'var(--font-sans)';

  return (
    <g>
      <text
        x={x + width / 2}
        y={labelY}
        textAnchor="middle"
        fill="var(--color-foreground)"
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontWeight={500}
      >
        {label}
      </text>
      {hasLiveValue && (
        <text
          x={x + width / 2}
          y={y + height - 10}
          textAnchor="middle"
          fill="var(--color-muted-foreground)"
          fontSize={10}
          fontFamily="var(--font-mono)"
        >
          {liveValue.length > 18 ? liveValue.slice(0, 16) + '…' : liveValue}
        </text>
      )}
      {showSwatch && swatchCss && (
        <rect
          x={x + width - 22}
          y={y + height / 2 - 8}
          width={16}
          height={16}
          rx={2}
          fill={swatchCss}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      )}
    </g>
  );
}

// --- Inner graph (subscribes to color context) ---

interface ColorStateGraphInnerProps {
  lastEventRef: MutableRefObject<{ interaction: ColorInteraction } | null>;
}

function ColorStateGraphInner({ lastEventRef }: ColorStateGraphInnerProps) {
  const api = useColorContext();
  const layout = useMemo(() => layoutGraph(), []);
  const [cascade, setCascade] = useState<{
    group: string;
    inputNode: NodeId | null;
  } | null>(null);
  const prevStateRef = useRef(api.state);

  useEffect(() => {
    const next = api.state;
    const prev = prevStateRef.current;
    const event = lastEventRef.current;

    let group: string | null = null;
    let inputNode: NodeId | null = null;

    const reqEqual =
      prev.requested.l === next.requested.l &&
      prev.requested.c === next.requested.c &&
      prev.requested.h === next.requested.h &&
      prev.requested.alpha === next.requested.alpha;

    if (!reqEqual && event) {
      group = 'color-change';
      inputNode = interactionToInputNode(event.interaction);
    } else if (next.activeGamut !== prev.activeGamut) {
      group = 'gamut-change';
      inputNode = 'input-gamut-toggle';
    } else if (next.activeView !== prev.activeView) {
      group = 'view-change';
      inputNode = 'input-view-toggle';
    }

    if (group) {
      prevStateRef.current = next;
      const id1 = setTimeout(() => {
        setCascade({ group, inputNode });
      }, 0);
      const id2 = setTimeout(() => setCascade(null), 600);
      return () => {
        clearTimeout(id1);
        clearTimeout(id2);
      };
    }
    prevStateRef.current = next;
  }, [api.state, lastEventRef]);

  const highlightedNodes = useMemo(() => {
    if (!cascade) return new Set<NodeId>();
    const set = new Set<NodeId>();
    if (cascade.inputNode) set.add(cascade.inputNode);
    GRAPH_EDGES.filter((e) => e.cascadeGroup === cascade.group).forEach((e) => {
      set.add(e.from);
      set.add(e.to);
    });
    return set;
  }, [cascade]);

  const highlightedEdges = useMemo(() => {
    if (!cascade) return new Set<string>();
    return new Set(
      GRAPH_EDGES.filter((e) => e.cascadeGroup === cascade.group).map(
        (e) => `${e.from}-${e.to}`,
      ),
    );
  }, [cascade]);

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full min-h-[280px] max-h-[520px]"
      style={{ overflow: 'visible' }}
      aria-label="Color state machine diagram"
    >
      <defs>
        <filter
          id="graph-edge-glow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Edges */}
      <g stroke="var(--color-border)" strokeWidth="1" fill="none">
        {layout.edges.map((ep) => {
          const key = `${ep.from}-${ep.to}`;
          const active = highlightedEdges.has(key);
          return (
            <path
              key={key}
              d={ep.d}
              stroke={active ? 'var(--color-accent)' : 'var(--color-border)'}
              strokeWidth={active ? 2 : 1}
              opacity={active ? 1 : 0.6}
              style={{
                transition:
                  'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
              }}
            />
          );
        })}
      </g>
      {/* Nodes */}
      {layout.nodes.map((node) => (
        <NodeShape
          key={node.id}
          node={node}
          highlighted={highlightedNodes.has(node.id)}
        >
          <GraphNodeContent node={node} api={api} />
        </NodeShape>
      ))}
    </svg>
  );
}

// --- Mini picker ---

function MiniPicker() {
  return (
    <div className="flex flex-col gap-3 items-start">
      <div
        className="relative rounded-lg overflow-hidden border border-[var(--color-border)]"
        style={{ width: 220, height: 160 }}
      >
        <ColorArea className="size-full">
          <Background />
          <ColorPlane />
          <Layer kind="overlay">
            <GamutBoundaryLayer />
          </Layer>
          <Thumb />
        </ColorArea>
      </div>
      <div className="w-full max-w-[220px]">
        <ColorSlider channel="h" className="w-full" />
      </div>
    </div>
  );
}

// --- Exported wrapper ---

export function ColorStateGraph() {
  const lastEventRef = useRef<{ interaction: ColorInteraction } | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Interact with the picker to see the state machine update in real time.
      </p>
      <ColorProvider
        defaultColor="#3b82f6"
        onChange={(event) => {
          lastEventRef.current = { interaction: event.interaction };
        }}
      >
        <div className="flex flex-col sm:flex-row flex-wrap items-start gap-8">
          <MiniPicker />
          <div className="flex-1 w-full min-w-0 sm:min-w-[320px]">
            <ColorStateGraphInner lastEventRef={lastEventRef} />
          </div>
        </div>
      </ColorProvider>
    </div>
  );
}
