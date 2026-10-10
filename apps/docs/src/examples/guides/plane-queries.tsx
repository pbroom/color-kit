import { useState } from 'react';
import { parse } from 'color-kit';
import {
  definePlane,
  inspectPlaneQuery,
  sense,
  toSvgCompoundPath,
  toSvgPath,
} from 'color-kit/plane';
import { Range, Readout } from './controls';

const WHITE = parse('#ffffff');

export default function PlaneQueries() {
  const [hue, setHue] = useState(264);

  // OKLCH by default: x is lightness [0, 1], y is chroma [0.4, 0].
  const plane = definePlane({ fixed: { h: hue } });
  const query = sense(plane);

  const srgb = query.gamutRegion({ gamut: 'srgb' });
  const p3 = query.gamutBoundary({ gamut: 'display-p3' });
  const { result: aa, trace } = inspectPlaneQuery(plane, {
    kind: 'contrastRegion',
    reference: WHITE,
    level: 'AA',
  });

  return (
    <div className="grid gap-4">
      <Range
        label="Hue"
        value={hue}
        min={0}
        max={359}
        step={1}
        format={(v) => `${v}°`}
        onChange={setHue}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Lightness by chroma plane at hue ${hue}°`}
        className="h-56 w-full rounded-sm border border-border text-foreground"
      >
        <title>
          sRGB region (filled), Display P3 boundary (dashed) and the region that
          passes WCAG AA against white (outlined)
        </title>
        <path
          d={toSvgCompoundPath(srgb.visibleRegion.paths, { closeLoop: true })}
          fill="currentColor"
          fillOpacity={0.12}
        />
        <path
          d={toSvgPath(p3.points)}
          fill="none"
          stroke="currentColor"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={toSvgCompoundPath(aa.paths)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <Readout
        rows={[
          ['solver', trace.summary.solver ?? 'n/a'],
          ['sampling', trace.summary.samplingMode ?? 'n/a'],
          ['points', String(trace.summary.resultPointCount)],
          ['dropped', String(trace.summary.droppedPieceCount ?? 0)],
        ]}
      />
    </div>
  );
}
