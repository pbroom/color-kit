import { useRef } from 'react';
import { getSliderGradientStyles } from 'color-kit/driver';
import {
  Color,
  useColorContext,
  useGamutBoundary,
  type ColorInteraction,
} from 'color-kit/react';
import {
  PlanePicker,
  type PlaneOverlayProps,
} from '@/examples/react/plane-picker';

// Paint the hue rail once, in Display P3 with an sRGB fallback.
const hueRail = getSliderGradientStyles({
  model: 'oklch',
  channel: 'h',
  baseColor: { l: 0.7, c: 0.15, h: 0, alpha: 1 },
  range: [0, 360],
});

/** The sRGB edge, dashed, from the same plane the canvas paints. */
function SrgbEdge({ color, axes, isDragging, quality }: PlaneOverlayProps) {
  const edge = useGamutBoundary(
    { color, axes },
    { gamut: 'srgb', isDragging, quality },
  );
  return (
    <path
      d={edge.path}
      fill="none"
      stroke="#fff"
      strokeDasharray="3 3"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Picker() {
  const {
    requested,
    displayed,
    setRequested,
    setChannel,
    activeGamut,
    setActiveGamut,
    requestedCss,
    displayedCss,
  } = useColorContext();
  const input = useRef<ColorInteraction>('pointer');
  return (
    <div className="grid max-w-80 gap-3">
      <PlanePicker
        color={requested}
        displayed={displayed}
        onChange={setRequested}
        label="Lightness and chroma"
        className="aspect-[3/2] w-full rounded-sm"
      >
        {(plane) => <SrgbEdge {...plane} />}
      </PlanePicker>
      <input
        type="range"
        aria-label="Hue"
        min={0}
        max={360}
        step={0.1}
        value={requested.h}
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
        className="h-3 w-full appearance-none rounded-full [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#fff] [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#fff] [&::-moz-range-thumb]:bg-transparent"
        style={{
          backgroundColor: hueRail.srgbBackgroundColor,
          backgroundImage: hueRail.activeBackgroundImage,
        }}
      />
      <div className="grid gap-1 [font-family:var(--font-mono)] text-[13px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={activeGamut === 'srgb'}
            onChange={(event) =>
              setActiveGamut(
                event.currentTarget.checked ? 'srgb' : 'display-p3',
              )
            }
          />
          Preview in sRGB
        </label>
        <span>requested {requestedCss('oklch')}</span>
        <span>displayed {displayedCss('oklch')}</span>
      </div>
    </div>
  );
}

export default function ReactPicker() {
  return (
    <Color defaultColor="oklch(0.7 0.25 150)">
      <Picker />
    </Color>
  );
}
