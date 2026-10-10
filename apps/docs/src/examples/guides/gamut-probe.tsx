import { useState } from 'react';
import {
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
  toLinearP3Array,
  toLinearSrgbArray,
  type Color,
} from 'color-kit';
import { Range, Readout } from './controls';

/** Unclamped linear channels: negative or above 1 means out of gamut. */
const channels = (values: readonly number[]) =>
  values.map((v) => v.toFixed(4).replace(/^-(0\.0+)$/, '$1')).join('  ');

export default function GamutProbe() {
  const [l, setL] = useState(0.75);
  const [c, setC] = useState(0.2);
  const [h, setH] = useState(150);
  const color: Color = { l, c, h, alpha: 1 };

  return (
    <div className="grid gap-4">
      <Range
        label="L"
        value={l}
        min={0}
        max={1}
        step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={setL}
      />
      <Range
        label="C"
        value={c}
        min={0}
        max={0.4}
        step={0.001}
        format={(v) => v.toFixed(3)}
        onChange={setC}
      />
      <Range
        label="H"
        value={h}
        min={0}
        max={359}
        step={1}
        format={(v) => `${v}°`}
        onChange={setH}
      />
      <Readout
        rows={[
          ['linear sRGB', channels(toLinearSrgbArray(color))],
          ['inSrgbGamut', String(inSrgbGamut(color))],
          ['max sRGB c', maxChromaAt(l, h, { gamut: 'srgb' }).toFixed(4)],
          ['linear P3', channels(toLinearP3Array(color))],
          ['inP3Gamut', String(inP3Gamut(color))],
          ['max P3 c', maxChromaAt(l, h, { gamut: 'display-p3' }).toFixed(4)],
        ]}
      />
    </div>
  );
}
