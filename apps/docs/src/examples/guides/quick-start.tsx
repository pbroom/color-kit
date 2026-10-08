import { useState } from 'react';
import {
  contrastRatio,
  inP3Gamut,
  inSrgbGamut,
  parse,
  toCss,
  toSrgbGamut,
  tryParse,
} from 'color-kit';
import { Chip, Readout } from './controls';

const WHITE = parse('#fff');
const BLACK = parse('#000');

export default function QuickStart() {
  const [input, setInput] = useState('oklch(0.7 0.25 30)');
  const color = tryParse(input);
  const shown = color ? toSrgbGamut(color) : null;

  return (
    <div className="grid gap-4">
      <input
        aria-label="CSS color"
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
        spellCheck={false}
        className="w-full rounded-sm border border-border bg-transparent px-2 py-1 [font-family:var(--font-mono)] text-[13px] text-foreground"
      />
      {color && shown ? (
        <div className="flex items-start gap-4">
          <Chip css={toCss(shown, 'hex')} label="Displayed in sRGB" />
          <Readout
            rows={[
              ['parse', toCss(color, 'oklch')],
              ['inSrgbGamut', String(inSrgbGamut(color))],
              ['inP3Gamut', String(inP3Gamut(color))],
              ['toSrgbGamut', toCss(shown, 'oklch')],
              ['vs white', `${contrastRatio(shown, WHITE).toFixed(2)}:1`],
              ['vs black', `${contrastRatio(shown, BLACK).toFixed(2)}:1`],
            ]}
          />
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">
          <code>tryParse</code> returned <code>null</code>: not a CSS color.
        </p>
      )}
    </div>
  );
}
