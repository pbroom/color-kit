import { useMemo, type HTMLAttributes } from 'react';
import { maxChromaAt } from '@color-kit/core';
import { useSelector } from '@legendapp/state/react';
import { useOptionalColorContext } from './context.js';
import { SliderMarker } from './slider-marker.js';
import { useColorSliderContext } from './color-slider-context.js';

const FALLBACK_EPSILON = 0.0001;

export interface ChromaMarkersProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Override gamut target used for max-chroma marker math. */
  gamut?: 'srgb' | 'display-p3';
  /** Number of lightness samples used for hue-wide max chroma. */
  hueMaxSteps?: number;
}

/**
 * Convenience marker set for chroma rails.
 *
 * Renders:
 * - current lightness+hue max chroma marker
 * - hue-wide max chroma marker
 * - fallback mini-thumb marker when the requested chroma exceeds current max
 */
export function ChromaMarkers({
  gamut,
  hueMaxSteps = 64,
  ...props
}: ChromaMarkersProps) {
  const slider = useColorSliderContext();
  const colorContext = useOptionalColorContext();
  const activeGamut = useSelector(
    () => colorContext?.state$.activeGamut.get() ?? null,
  );

  const resolvedGamut = gamut ?? activeGamut ?? 'display-p3';
  const maxRangeChroma = Math.max(0, slider.range[0], slider.range[1]);

  const normalizedHueSteps = Math.max(2, Math.round(hueMaxSteps));

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

    let hueWide = 0;
    for (let index = 0; index <= normalizedHueSteps; index += 1) {
      const lightness = index / normalizedHueSteps;
      const sample = maxChromaAt(lightness, slider.requested.h, {
        gamut: resolvedGamut,
        maxChroma: maxRangeChroma,
      });
      if (sample > hueWide) {
        hueWide = sample;
      }
    }

    return {
      currentMaxChroma: current,
      hueWideMaxChroma: hueWide,
    };
  }, [
    maxRangeChroma,
    normalizedHueSteps,
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
