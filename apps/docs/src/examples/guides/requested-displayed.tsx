import { useState } from 'react';
import { toCss, type Color, type GamutMapMethod } from 'color-kit';
import { createColorState } from 'color-kit/driver';
import { Chip, Range, Readout, Toggle } from './controls';

const METHODS = [
  'chroma-reduction',
  'css',
] as const satisfies readonly GamutMapMethod[];

const oklch = (color: Color) => toCss(color, 'oklch');

export default function RequestedDisplayed() {
  const [chroma, setChroma] = useState(0.3);
  const [hue, setHue] = useState(150);
  const [method, setMethod] = useState<GamutMapMethod>('chroma-reduction');

  // One state object holds the request and both displayed mappings.
  const state = createColorState(
    { l: 0.72, c: chroma, h: hue, alpha: 1 },
    { gamutMapMethod: method },
  );
  const { requested, displayed, meta } = state;

  return (
    <div className="grid gap-4">
      <Range
        label="Chroma"
        value={chroma}
        min={0}
        max={0.4}
        step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={setChroma}
      />
      <Range
        label="Hue"
        value={hue}
        min={0}
        max={359}
        step={1}
        format={(v) => `${v}°`}
        onChange={setHue}
      />
      <Toggle
        label="Gamut mapping method"
        options={METHODS}
        value={method}
        onChange={setMethod}
      />
      <div className="flex items-center gap-2">
        <Chip css={toCss(displayed.srgb, 'hex')} label="Displayed in sRGB" />
        <Chip
          css={toCss(displayed.p3, 'display-p3')}
          label="Displayed in Display P3"
        />
      </div>
      <Readout
        rows={[
          ['requested', oklch(requested)],
          ['displayed.srgb', oklch(displayed.srgb)],
          ['displayed.p3', oklch(displayed.p3)],
          [
            'outOfGamut',
            `srgb: ${meta.outOfGamut.srgb}, p3: ${meta.outOfGamut.p3}`,
          ],
        ]}
      />
    </div>
  );
}
