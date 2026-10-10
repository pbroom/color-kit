import { getSliderGradientStyles } from 'color-kit/driver';
import {
  Color,
  ColorArea,
  ColorPlane,
  ColorSlider,
  ColorStringInput,
  GamutBoundaryLayer,
  Thumb,
  useColorContext,
} from 'color-kit/react';

// The primitives ship unstyled; paint the hue rail once, in Display P3.
const hueRail = getSliderGradientStyles({
  model: 'oklch',
  channel: 'h',
  baseColor: { l: 0.7, c: 0.15, h: 0, alpha: 1 },
  range: [0, 360],
});

const thumb =
  'size-3.5 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.5)]';

function GamutSwitch() {
  const { activeGamut, setActiveGamut, requestedCss, displayedCss } =
    useColorContext();
  return (
    <div className="grid gap-1 [font-family:var(--font-mono)] text-[13px]">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={activeGamut === 'srgb'}
          onChange={(event) =>
            setActiveGamut(event.currentTarget.checked ? 'srgb' : 'display-p3')
          }
        />
        Preview in sRGB
      </label>
      <span>requested {requestedCss('oklch')}</span>
      <span>displayed {displayedCss('oklch')}</span>
    </div>
  );
}

export default function ReactPicker() {
  return (
    <Color defaultColor="oklch(0.7 0.25 150)">
      <div className="grid max-w-80 gap-3">
        <ColorArea className="aspect-[3/2] w-full overflow-hidden rounded-sm">
          <ColorPlane />
          <GamutBoundaryLayer
            gamut="srgb"
            pathProps={{
              stroke: '#fff',
              strokeDasharray: '3 3',
              vectorEffect: 'non-scaling-stroke',
            }}
          />
          <Thumb className={thumb} />
        </ColorArea>
        <ColorSlider
          channel="h"
          // The slider's only child is its thumb.
          className="h-3 rounded-full *:size-3.5 *:rounded-full *:border-2 *:border-[#fff] *:shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
          style={{
            backgroundColor: hueRail.srgbBackgroundColor,
            backgroundImage: hueRail.activeBackgroundImage,
          }}
        />
        <ColorStringInput
          format="oklch"
          className="[&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-border [&_input]:bg-transparent [&_input]:px-2 [&_input]:py-1 [&_input]:[font-family:var(--font-mono)] [&_input]:text-[13px]"
        />
        <GamutSwitch />
      </div>
    </Color>
  );
}
