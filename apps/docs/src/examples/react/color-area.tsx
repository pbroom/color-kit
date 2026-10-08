import {
  Color,
  ColorArea,
  ColorPlane,
  GamutBoundaryLayer,
  Thumb,
  useColorContext,
} from 'color-kit/react';

function Readout() {
  const { requestedCss, displayedCss, state } = useColorContext();
  return (
    <dl className="grid grid-cols-[9ch_1fr] gap-x-3 gap-y-1 [font-family:var(--font-mono)] text-[12px]">
      <dt className="text-muted-foreground">requested</dt>
      <dd>{requestedCss('oklch')}</dd>
      <dt className="text-muted-foreground">displayed</dt>
      <dd>{displayedCss('oklch')}</dd>
      <dt className="text-muted-foreground">in sRGB</dt>
      <dd>{state.meta.outOfGamut.srgb ? 'no, mapped' : 'yes'}</dd>
    </dl>
  );
}

export default function ColorAreaExample() {
  return (
    <Color defaultColor="oklch(0.66 0.24 268)">
      <div className="grid max-w-96 gap-4">
        {/* Lightness across, chroma up. The hue stays where it is. */}
        <ColorArea
          axes={{ x: { channel: 'l' }, y: { channel: 'c', range: [0, 0.37] } }}
          className="aspect-[4/3] w-full touch-none overflow-hidden rounded-md"
        >
          <ColorPlane />
          {/* Dashed: the sRGB edge. Solid: the Display P3 edge. */}
          <GamutBoundaryLayer
            gamut="srgb"
            pathProps={{
              stroke: '#fff',
              strokeWidth: 1.5,
              strokeDasharray: '4 3',
              vectorEffect: 'non-scaling-stroke',
            }}
          />
          <GamutBoundaryLayer
            gamut="display-p3"
            pathProps={{
              stroke: '#fff',
              strokeWidth: 1.5,
              vectorEffect: 'non-scaling-stroke',
            }}
          />
          <Thumb
            aria-label="Lightness and chroma"
            className="size-4 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.45)] data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-[var(--focus-ring-color)]"
          />
        </ColorArea>
        <Readout />
      </div>
    </Color>
  );
}
