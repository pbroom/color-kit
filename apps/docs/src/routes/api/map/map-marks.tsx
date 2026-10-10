import type { KindGroup, MapNode } from './map-model';
import { kindGroup } from './map-model';

/**
 * Kind marks, read without color: shape names the kind, fill says whether
 * it exists at runtime (filled) or only as a type (hollow). Re-exports are
 * dashed. Groups are rings: filled when closed, hollow when open.
 */
const SHAPES: Record<KindGroup, string> = {
  function: 'M3.6,0A3.6,3.6 0 1 1 -3.6,0A3.6,3.6 0 1 1 3.6,0Z',
  component: 'M-3.2,-3.2H3.2V3.2H-3.2Z',
  class: 'M0,-4.4L4.4,0L0,4.4L-4.4,0Z',
  value: 'M0,-4.2L3.9,2.9H-3.9Z',
  type: 'M3.6,0A3.6,3.6 0 1 1 -3.6,0A3.6,3.6 0 1 1 3.6,0Z',
};

export function KindMark({
  group,
  reexport = false,
}: {
  group: KindGroup;
  reexport?: boolean;
}) {
  return (
    <path
      className="map-mark"
      data-kind={group}
      data-reexport={reexport || undefined}
      d={SHAPES[group]}
    />
  );
}

export function NodeMark({ node, open }: { node: MapNode; open: boolean }) {
  if (node.children) {
    return (
      <circle
        className="map-mark map-mark--group"
        data-open={open || undefined}
        r={node.type === 'root' ? 5 : 4.25}
      />
    );
  }
  return (
    <KindMark
      group={kindGroup(node.kind ?? 'function')}
      reexport={node.canonicalEntry !== undefined}
    />
  );
}

/** A mark in an inline 12×12 SVG, for the legend and ledger headings. */
export function LegendMark({
  group,
  reexport,
  ring,
}: {
  group?: KindGroup;
  reexport?: boolean;
  ring?: 'open' | 'closed';
}) {
  return (
    <svg
      className="map-legend-mark"
      viewBox="-6 -6 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      {ring ? (
        <circle
          className="map-mark map-mark--group"
          data-open={ring === 'open' || undefined}
          r={4.25}
        />
      ) : (
        <KindMark group={group ?? 'function'} reexport={reexport} />
      )}
    </svg>
  );
}
