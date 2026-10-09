import { useState } from 'react';
import {
  formatColorStringInputValue,
  getSliderGradientStyles,
  parseColorStringInputValue,
} from 'color-kit/driver';
import { Color, useColorContext } from 'color-kit/react';

const CHANNELS = [
  { channel: 'l', label: 'Lightness', range: [0, 1], step: 0.001 },
  { channel: 'c', label: 'Chroma', range: [0, 0.37], step: 0.001 },
  { channel: 'h', label: 'Hue', range: [0, 360], step: 0.1 },
] as const;

// Native range inputs bring their own keyboard and ARIA; this only paints
// the track and the thumb.
const range =
  'h-3.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#fff] [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#fff] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(0_0_0/0.45)]';

function ChannelSlider({
  channel,
  label,
  range: bounds,
  step,
}: (typeof CHANNELS)[number]) {
  const { requested, activeGamut, setChannel } = useColorContext();
  // Sample the rail from the current color, so it previews what dragging
  // this channel would produce.
  const rail = getSliderGradientStyles({
    model: 'oklch',
    channel,
    baseColor: requested,
    range: [bounds[0], bounds[1]],
    colorSpace: activeGamut,
  });
  return (
    <label className="grid grid-cols-[9ch_1fr] items-center gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={bounds[0]}
        max={bounds[1]}
        step={step}
        value={requested[channel]}
        onChange={(event) =>
          setChannel(channel, Number(event.currentTarget.value), {
            interaction: 'pointer',
          })
        }
        className={range}
        style={{
          backgroundColor: rail.srgbBackgroundColor,
          backgroundImage: rail.activeBackgroundImage,
        }}
      />
    </label>
  );
}

/** Commits any CSS color on Enter or blur; Escape and invalid text revert. */
function ColorText() {
  const { requested, setFromString } = useColorContext();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatColorStringInputValue(requested, 'oklch');
  const commit = () => {
    if (draft === null) return;
    // Invalid text is dropped, so the field shows the current color again.
    if (parseColorStringInputValue(draft)) setFromString(draft);
    setDraft(null);
  };
  return (
    <input
      aria-label="Color"
      value={shown}
      aria-invalid={
        draft !== null && parseColorStringInputValue(draft) === null
      }
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(null);
      }}
      className="w-full rounded-sm border border-border bg-transparent px-2 py-1 [font-family:var(--font-mono)] text-[13px] aria-[invalid=true]:border-[var(--danger,#d33)]"
    />
  );
}

export default function ChannelInputs() {
  return (
    <Color defaultColor="oklch(0.7 0.16 45)">
      <div className="grid max-w-96 gap-4">
        {CHANNELS.map((entry) => (
          <ChannelSlider key={entry.channel} {...entry} />
        ))}
        <ColorText />
      </div>
    </Color>
  );
}
