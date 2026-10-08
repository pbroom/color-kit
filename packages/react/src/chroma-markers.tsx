import { useMemo, type HTMLAttributes } from 'react';
import { maxChromaAt, maxChromaForHue } from '@color-kit/core';
import { useColorStoreSelector } from './color-store.js';
import { useOptionalColorContext } from './context.js';
import { SliderMarker } from './slider-marker.js';
import { useColorSliderContext } from './color-slider-context.js';

const FALLBACK_EPSILON = 0.0001;

/** Props for {@link ChromaMarkers}; other `div` attributes are passed to each marker. */
export interface ChromaMarkersProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Override gamut target used for max-chroma marker math. Defaults to the
   * provider's active gamut, or `'display-p3'` without a provider.
   */
  gamut?: 'srgb' | 'display-p3';
  /**
   * Compatibility tuning knob for hue-wide max marker accuracy.
   * Higher values increase the internal hue cusp LUT density.
   * @defaultValue 64
   */
  hueMaxSteps?: number;
}

/**
 * Set of {@link SliderMarker}s showing the gamut limits on a chroma
 * {@link ColorSlider} (`channel="c"`); renders nothing on other channels.
 *
 * Renders:
 * - current lightness+hue max chroma marker
 * - hue-wide max chroma marker
 * - fallback mini-thumb marker when the requested chroma exceeds current max
 *
 * Markers are capped at the slider range and tagged with
 * `data-color-slider-marker-kind` (`current-max`, `hue-max`,
 * `fallback-thumb`) and `data-gamut` for styling.
 *
 * @throws {Error} When rendered outside a `<ColorSlider>`.
 *
 * @example
 * ```tsx
 * import { ChromaMarkers, Color, ColorSlider } from 'color-kit/react';
 *
 * export const ChromaSlider = () => (
 *   <Color defaultColor="oklch(0.7 0.3 150)">
 *     <ColorSlider channel="c" style={{ height: 16 }}>
 *       <ChromaMarkers gamut="srgb" />
 *     </ColorSlider>
 *   </Color>
 * );
 * ```
 */
export function ChromaMarkers({
  gamut,
  hueMaxSteps = 64,
  ...props
}: ChromaMarkersProps) {
  const slider = useColorSliderContext();
  const colorContext = useOptionalColorContext();
  const activeGamut = useColorStoreSelector(
    colorContext?.store ?? null,
    (state) => state?.activeGamut ?? null,
  );

  const resolvedGamut = gamut ?? activeGamut ?? 'display-p3';
  const maxRangeChroma = Math.max(0, slider.range[0], slider.range[1]);

  const normalizedHueSteps = Math.max(2, Math.round(hueMaxSteps));
  const hueCuspLutSize = Math.max(256, normalizedHueSteps * 64);

  const { currentMaxChroma, hueWideMaxChroma } = useMemo(() => {
    if (slider.channel !== 'c') {
      return {
        currentMaxChroma: 0,
        hueWideMaxChroma: 0,
      };
    }

    const current = maxChromaAt(slider.requested.l, slider.requested.h, {
      gamut: resolvedGamut,
      maxChroma: maxRangeChroma,
    });

    const hueWide = Math.min(
      maxRangeChroma,
      maxChromaForHue(slider.requested.h, {
        gamut: resolvedGamut,
        method: 'lut',
        lutSize: hueCuspLutSize,
      }).c,
    );

    return {
      currentMaxChroma: current,
      hueWideMaxChroma: hueWide,
    };
  }, [
    maxRangeChroma,
    hueCuspLutSize,
    resolvedGamut,
    slider.channel,
    slider.requested.h,
    slider.requested.l,
  ]);

  if (slider.channel !== 'c') {
    return null;
  }

  const showFallbackThumb =
    slider.requested.c > currentMaxChroma + FALLBACK_EPSILON;

  return (
    <>
      <SliderMarker
        {...props}
        value={currentMaxChroma}
        variant="dot"
        data-color-slider-marker-kind="current-max"
        data-gamut={resolvedGamut}
      />
      <SliderMarker
        {...props}
        value={hueWideMaxChroma}
        variant="dot"
        data-color-slider-marker-kind="hue-max"
        data-gamut={resolvedGamut}
      />
      {showFallbackThumb ? (
        <SliderMarker
          {...props}
          value={currentMaxChroma}
          variant="mini-thumb"
          data-color-slider-marker-kind="fallback-thumb"
          data-gamut={resolvedGamut}
        />
      ) : null}
    </>
  );
}
