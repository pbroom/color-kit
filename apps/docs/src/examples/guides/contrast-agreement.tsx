import { useState } from 'react';
import {
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  inSrgbGamut,
  parse,
  toCss,
  type Color,
} from 'color-kit';
import { Range, Readout, Toggle } from './controls';

const REFERENCES = { white: parse('#ffffff'), black: parse('#000000') };
type Reference = keyof typeof REFERENCES;
const METRICS = ['wcag', 'apca'] as const;
type Metric = (typeof METRICS)[number];

export default function ContrastAgreement() {
  const [hue, setHue] = useState(250);
  const [ref, setRef] = useState<Reference>('white');
  const [metric, setMetric] = useState<Metric>('wcag');
  const reference = REFERENCES[ref];

  // WCAG AA is 4.5:1; APCA "body" is Lc 60, normalized to 0.6.
  const paths = contrastRegionPaths(reference, hue, {
    metric,
    ...(metric === 'wcag' ? { level: 'AA' } : { apcaPreset: 'body' }),
  });
  const measure = (color: Color) =>
    metric === 'wcag'
      ? contrastRatio(color, reference)
      : Math.abs(contrastAPCA(color, reference));
  const threshold = metric === 'wcag' ? 4.5 : 0.6;

  // Re-check every contour point with the public functions.
  const points = paths.flat().map(({ l, c }) => ({ l, c, h: hue, alpha: 1 }));
  const passing = points.filter(
    (color) => measure(color) >= threshold && inSrgbGamut(color),
  );
  const samples = points.filter(
    (_, i) => i % Math.ceil(points.length / 5) === 0,
  );

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
      <div className="flex flex-wrap gap-3">
        <Toggle
          label="Reference"
          options={['white', 'black'] as const}
          value={ref}
          onChange={setRef}
        />
        <Toggle
          label="Metric"
          options={METRICS}
          value={metric}
          onChange={setMetric}
        />
      </div>
      <div
        className="flex flex-wrap gap-4 rounded-sm border border-border p-3"
        style={{ background: toCss(reference, 'hex') }}
      >
        {samples.map((color) => (
          <span
            key={`${color.l}-${color.c}`}
            className="font-[600]"
            style={{ color: toCss(color, 'oklch') }}
          >
            Aa {measure(color).toFixed(3)}
          </span>
        ))}
      </div>
      <Readout
        rows={[
          ['contour points', String(points.length)],
          ['pass the check', `${passing.length} of ${points.length}`],
        ]}
      />
    </div>
  );
}
