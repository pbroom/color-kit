import { useState } from 'react';
import { parse } from 'color-kit';
import { createColorState } from 'color-kit/driver';
import {
  Color,
  ColorArea,
  ColorPlane,
  ColorSlider,
  Thumb,
  type ColorUpdateEvent,
} from 'color-kit/react';

const START = createColorState(parse('oklch(0.62 0.19 30)'));

const thumb =
  'size-4 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.45)] data-[disabled]:opacity-40';

export default function ControlledColor() {
  // Controlled: this component owns the state; <Color> only reports updates.
  const [state, setState] = useState(START);
  const [last, setLast] = useState<ColorUpdateEvent | null>(null);
  const [disabled, setDisabled] = useState(false);

  return (
    <Color
      state={state}
      onChange={(event) => {
        setState(event.next);
        setLast(event);
      }}
    >
      <div className="grid max-w-96 gap-4">
        <ColorArea
          disabled={disabled}
          className="aspect-[2/1] w-full touch-none overflow-hidden rounded-md data-[disabled]:opacity-60"
        >
          <ColorPlane />
          <Thumb aria-label="Lightness and chroma" className={thumb} />
        </ColorArea>
        <ColorSlider
          channel="h"
          aria-label="Hue"
          disabled={disabled}
          // The slider's only child is its thumb.
          className="h-3 rounded-full bg-[linear-gradient(90deg,oklch(0.7_0.15_0),oklch(0.7_0.15_90),oklch(0.7_0.15_180),oklch(0.7_0.15_270),oklch(0.7_0.15_360))] data-[disabled]:opacity-60 *:size-4 *:rounded-full *:border-2 *:border-[#fff] *:shadow-[0_0_0_1px_rgb(0_0_0/0.45)]"
        />
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(event) => setDisabled(event.currentTarget.checked)}
            />
            Disabled
          </label>
          <button
            type="button"
            className="rounded-sm border border-border px-2 py-0.5"
            onClick={() => {
              setState(START);
              setLast(null);
            }}
          >
            Reset
          </button>
        </div>
        <p className="m-0 [font-family:var(--font-mono)] text-[12px]">
          {last
            ? `last update: ${last.interaction}, channel ${last.changedChannel ?? '(none)'}`
            : 'no updates yet: drag, or focus a thumb and use the arrow keys'}
        </p>
      </div>
    </Color>
  );
}
