import { useState } from 'react';
import { isAchromatic, toCss, toSrgbGamut, tryParse } from 'color-kit';
import { Chip, Readout, Toggle } from './controls';

const PRESETS = [
  '#3b82f6',
  '#808080',
  'oklch(0.7 0.15 -30)',
  'hsl(210 90% 55% / 0.5)',
  'color(display-p3 0 1 0)',
] as const;

const fixed = (value: number, digits: number) => value.toFixed(digits);

export default function OklchInspector() {
  const [input, setInput] = useState<string>(PRESETS[0]);
  // tryParse returns null instead of throwing, which suits typed input.
  const color = tryParse(input);

  return (
    <div className="grid gap-4">
      <Toggle
        label="Presets"
        options={PRESETS}
        value={input as (typeof PRESETS)[number]}
        onChange={setInput}
      />
      <input
        aria-label="CSS color"
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
        spellCheck={false}
        className="w-full rounded-sm border border-border bg-transparent px-2 py-1 [font-family:var(--font-mono)] text-[13px] text-foreground"
      />
      {color ? (
        <div className="flex items-start gap-4">
          <Chip
            css={toCss(toSrgbGamut(color), 'oklch')}
            label={`Swatch for ${input}`}
          />
          <Readout
            rows={[
              ['l', fixed(color.l, 4)],
              ['c', fixed(color.c, 4)],
              [
                'h',
                isAchromatic(color.c)
                  ? `${color.h} (powerless)`
                  : fixed(color.h, 2),
              ],
              ['alpha', fixed(color.alpha, 3)],
              ['toCss', toCss(color, 'oklch')],
            ]}
          />
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">
          Not a CSS Color 4 color: <code>tryParse</code> returned{' '}
          <code>null</code>.
        </p>
      )}
    </div>
  );
}
