import { useRef, useState } from 'react';
import { parse } from 'color-kit';
import { createColorState } from 'color-kit/driver';
import {
  Color,
  useColorContext,
  type ColorInteraction,
  type ColorUpdateEvent,
} from 'color-kit/react';
import { PlanePicker } from './plane-picker';

const START = createColorState(parse('oklch(0.62 0.19 30)'));

/** Any component under the provider reads and writes the shared color. */
function ProviderPicker({ disabled }: { disabled: boolean }) {
  const { requested, displayed, setRequested, setChannel } = useColorContext();
  const input = useRef<ColorInteraction>('pointer');
  return (
    <>
      <PlanePicker
        color={requested}
        displayed={displayed}
        onChange={setRequested}
        label="Lightness and chroma"
        disabled={disabled}
        className="aspect-[2/1] w-full rounded-md data-[dragging]:cursor-grabbing"
      />
      <input
        type="range"
        aria-label="Hue"
        min={0}
        max={360}
        step={1}
        disabled={disabled}
        value={Math.round(requested.h)}
        // A native range reports keyboard and pointer changes alike; note
        // which one started it so the update event names it.
        onPointerDown={() => {
          input.current = 'pointer';
        }}
        onKeyDown={() => {
          input.current = 'keyboard';
        }}
        onChange={(event) =>
          setChannel('h', Number(event.currentTarget.value), {
            interaction: input.current,
          })
        }
      />
    </>
  );
}

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
        <ProviderPicker disabled={disabled} />
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
            : 'no updates yet: drag, or focus the thumb and use the arrow keys'}
        </p>
      </div>
    </Color>
  );
}
