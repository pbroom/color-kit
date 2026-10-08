import { useState } from 'react';
import { parse, toCss, toSrgbGamut } from 'color-kit';
import { packColors, unpackColors, type ArraySpace } from 'color-kit/interop';
import { Toggle } from './controls';

const SPACES = [
  'linearSrgb',
  'srgb',
  'linearP3',
  'display-p3',
  'oklab',
  'oklch',
] as const satisfies readonly ArraySpace[];
const MODES = ['as requested', 'mapped to sRGB'] as const;

const COLORS = [
  parse('#ff0000'),
  parse('oklch(0.7 0.25 150)'), // outside sRGB
  parse('#3b82f680'),
];

/** Fixed-point, without a sign on rounded zeros (`-0.0000`). */
const fixed = (value: number) => value.toFixed(4).replace(/^-(0\.0+)$/, '$1');

export default function PackInspector() {
  const [space, setSpace] = useState<ArraySpace>('linearSrgb');
  const [mode, setMode] = useState<(typeof MODES)[number]>('as requested');
  const [alpha, setAlpha] = useState(false);

  // Gamut mapping is composed, not an option: map first, then pack.
  const colors =
    mode === 'mapped to sRGB' ? COLORS.map((c) => toSrgbGamut(c)) : COLORS;
  const packed = packColors(colors, space, undefined, { alpha });
  const stride = alpha ? 4 : 3;
  const roundTrip = unpackColors(packed, space, { alpha });

  return (
    <div className="grid gap-3">
      <Toggle
        label="Space"
        options={SPACES}
        value={space as (typeof SPACES)[number]}
        onChange={setSpace}
      />
      <div className="flex flex-wrap gap-3">
        <Toggle
          label="Mapping"
          options={MODES}
          value={mode}
          onChange={setMode}
        />
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={alpha}
            onChange={(e) => setAlpha(e.currentTarget.checked)}
          />
          alpha (vec4)
        </label>
      </div>
      <p className="m-0 [font-family:var(--font-mono)] text-[13px] text-muted-foreground">
        {packed.constructor.name}({packed.length}), stride {stride}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full [font-family:var(--font-mono)] text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="font-[400]">input</th>
              <th className="font-[400]">packed</th>
              <th className="font-[400]">unpacked</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((color, i) => (
              <tr key={toCss(COLORS[i], 'oklch')}>
                <td>{toCss(color, 'oklch')}</td>
                <td className="tnum">
                  {Array.from(
                    packed.subarray(i * stride, (i + 1) * stride),
                    fixed,
                  ).join(' ')}
                </td>
                <td>{toCss(roundTrip[i], 'oklch')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
