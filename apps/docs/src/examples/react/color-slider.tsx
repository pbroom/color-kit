import { getSliderGradientStyles } from 'color-kit/driver';
import { Color, ColorSlider, useColorContext } from 'color-kit/react';

const RANGES: Record<'l' | 'c' | 'h', [number, number]> = {
  l: [0, 1],
  c: [0, 0.37],
  h: [0, 360],
};

const LABELS = { l: 'Lightness', c: 'Chroma', h: 'Hue' };

function ChannelSlider({ channel }: { channel: 'l' | 'c' | 'h' }) {
  // Re-sample the rail from the current color, so each rail previews
  // exactly what dragging its thumb would produce.
  const { requested, activeGamut } = useColorContext();
  const rail = getSliderGradientStyles({
    model: 'oklch',
    channel,
    baseColor: requested,
    range: RANGES[channel],
    colorSpace: activeGamut,
  });
  return (
    <div className="grid grid-cols-[9ch_1fr] items-center gap-3 text-[13px]">
      <span className="text-muted-foreground">{LABELS[channel]}</span>
      <ColorSlider
        channel={channel}
        range={RANGES[channel]}
        aria-label={LABELS[channel]}
        // The slider's only child is its thumb.
        className="h-3.5 rounded-full *:size-4 *:rounded-full *:border-2 *:border-[#fff] *:shadow-[0_0_0_1px_rgb(0_0_0/0.45)] data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-4 data-[focus-visible]:outline-[var(--focus-ring-color)]"
        style={{
          backgroundColor: rail.srgbBackgroundColor,
          backgroundImage: rail.activeBackgroundImage,
        }}
      />
    </div>
  );
}

export default function ColorSliderExample() {
  return (
    <Color defaultColor="oklch(0.7 0.16 45)">
      <div className="grid max-w-96 gap-4">
        <ChannelSlider channel="l" />
        <ChannelSlider channel="c" />
        <ChannelSlider channel="h" />
      </div>
    </Color>
  );
}
