import { toCss, toP3Gamut, toSrgbGamut, type Color } from 'color-kit';
import {
  ColorApi,
  useColorContext,
  type ColorSliderChannel,
  type SliderHueGradientMode,
} from 'color-kit/react';
import type { CSSProperties } from 'react';

type SliderRailStyle = CSSProperties & {
  '--ck-slider-gradient-active': string;
  '--ck-slider-gradient-srgb': string;
  '--ck-slider-fallback-color': string;
  '--ck-slider-rail-start-active': string;
  '--ck-slider-rail-start-srgb': string;
  '--ck-slider-rail-end-active': string;
  '--ck-slider-rail-end-srgb': string;
  '--ck-slider-thumb-fill-active': string;
  '--ck-slider-thumb-fill-srgb': string;
};

export function getOklchSliderRail(
  channel: ColorSliderChannel,
  requested: Color,
  gamut: 'display-p3' | 'srgb',
  hueGradientMode?: SliderHueGradientMode,
): { colorSpace: 'display-p3' | 'srgb'; style: SliderRailStyle } {
  const range = ColorApi.resolveColorSliderRange(channel);
  const gradient = ColorApi.getSliderGradientStyles({
    model: 'oklch',
    channel,
    range,
    baseColor: requested,
    colorSpace: gamut,
    hueGradientMode,
  });
  const startStop = gradient.stops[0];
  const endStop = gradient.stops[gradient.stops.length - 1] ?? startStop;
  const thumbNorm = ColorApi.getColorSliderThumbPosition(
    requested,
    channel,
    range,
  );
  const thumbColor = ColorApi.colorFromColorSliderPosition(
    requested,
    channel,
    thumbNorm,
    range,
  );
  const thumbFillSrgb = toCss(toSrgbGamut(thumbColor), 'rgb');
  const thumbFillActive =
    gradient.colorSpace === 'display-p3'
      ? toCss(toP3Gamut(thumbColor), 'p3')
      : thumbFillSrgb;
  const railStartSrgb = startStop?.srgbCss ?? gradient.srgbBackgroundColor;
  const railEndSrgb = endStop?.srgbCss ?? railStartSrgb;
  const railStartActive = startStop?.activeCss ?? railStartSrgb;
  const railEndActive = endStop?.activeCss ?? railEndSrgb;

  return {
    colorSpace: gradient.colorSpace,
    style: {
      '--ck-slider-gradient-active': gradient.activeBackgroundImage,
      '--ck-slider-gradient-srgb': gradient.srgbBackgroundImage,
      '--ck-slider-fallback-color': gradient.srgbBackgroundColor,
      '--ck-slider-rail-start-active': railStartActive,
      '--ck-slider-rail-start-srgb': railStartSrgb,
      '--ck-slider-rail-end-active': railEndActive,
      '--ck-slider-rail-end-srgb': railEndSrgb,
      '--ck-slider-thumb-fill-active': thumbFillActive,
      '--ck-slider-thumb-fill-srgb': thumbFillSrgb,
    },
  };
}

export function DemoDisplaySwatch({
  requested,
  gamut,
  className,
}: {
  requested: Color;
  gamut: 'display-p3' | 'srgb';
  className?: string;
}) {
  const srgbBackground = toCss(toSrgbGamut(requested), 'rgb');
  const activeBackground =
    gamut === 'display-p3' ? toCss(toP3Gamut(requested), 'p3') : srgbBackground;

  return (
    <div
      className={className}
      style={{
        backgroundColor: srgbBackground,
        background: activeBackground,
      }}
    />
  );
}

export function ContextDisplaySwatch({ className }: { className?: string }) {
  const color = useColorContext();

  return (
    <DemoDisplaySwatch
      className={className}
      requested={color.requested}
      gamut={color.activeGamut}
    />
  );
}
