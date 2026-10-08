import { useState } from 'react';
import { toCss } from 'color-kit';
import { contrastPalette } from './contrast-palette';
import { Range } from './controls';

export default function ContrastPaletteDemo() {
  const [hue, setHue] = useState(250);
  const [chroma, setChroma] = useState(0.16);
  const { palette, gamut, onWhite, onBlack } = contrastPalette(hue, chroma);

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
      <Range
        label="Chroma"
        value={chroma}
        min={0}
        max={0.3}
        step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={setChroma}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Ramp steps on the lightness by chroma plane at hue ${hue}°`}
        className="h-40 w-full rounded-sm border border-border text-foreground"
      >
        <title>
          sRGB region (filled), the WCAG AA edge on white (solid) and on black
          (dashed), and one dot per ramp step
        </title>
        <path d={gamut} fill="currentColor" fillOpacity={0.1} />
        <path
          d={onWhite}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={onBlack}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
        {palette.map((step) => (
          // A zero-length round-capped line stays a dot when the SVG stretches.
          <path
            key={step.x}
            d={`M ${step.x} ${step.y} h 0`}
            stroke="currentColor"
            strokeWidth={7}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <ol className="m-0 grid list-none grid-cols-3 gap-1 p-0 sm:grid-cols-9">
        {palette.map((step) => (
          <li
            key={step.x}
            className="mt-0 grid gap-1 [font-family:var(--font-mono)] text-[11px]"
          >
            <span
              className="h-8 rounded-sm"
              style={{ background: toCss(step.color, 'hex') }}
              role="img"
              aria-label={toCss(step.color, 'hex')}
            />
            <span className="tnum">
              W {step.onWhite.toFixed(2)} {step.onWhite >= 4.5 ? 'AA' : ''}
            </span>
            <span className="tnum">
              B {step.onBlack.toFixed(2)} {step.onBlack >= 4.5 ? 'AA' : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
