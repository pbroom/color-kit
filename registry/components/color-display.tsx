'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  toCss,
  toHex,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';
import { useOptionalColorContext } from '@/hooks/color-context';
import type { GamutTarget } from '@/hooks/use-color';

export interface ColorDisplayProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color'
> {
  requested?: Color;
  gamut?: GamutTarget;
}

function getDisplayStyles(
  displayed: Color,
  srgbFallback: Color,
  activeGamut: GamutTarget,
): { backgroundColor: string; backgroundImage?: string } {
  if (activeGamut === 'display-p3') {
    const p3 = toCss(displayed, 'p3');
    return {
      backgroundColor:
        srgbFallback.alpha < 1
          ? toCss(srgbFallback, 'rgb')
          : toHex(srgbFallback),
      backgroundImage: `linear-gradient(${p3}, ${p3})`,
    };
  }

  return {
    backgroundColor:
      displayed.alpha < 1 ? toCss(displayed, 'rgb') : toHex(displayed),
  };
}

export const ColorDisplay = forwardRef<HTMLDivElement, ColorDisplayProps>(
  function ColorDisplay(
    { requested: requestedProp, gamut = 'display-p3', style, ...props },
    ref,
  ) {
    const context = useOptionalColorContext();

    const requested = requestedProp ?? context?.requested;
    const activeGamut = context?.activeGamut ?? gamut;

    if (!requested) {
      throw new Error(
        'ColorDisplay requires either a <ColorProvider> ancestor or an explicit requested prop.',
      );
    }

    const displayedSrgb = toSrgbGamut(requested);
    const displayedP3 = toP3Gamut(requested);
    const displayed =
      activeGamut === 'display-p3' ? displayedP3 : displayedSrgb;
    const displayedHex = toHex(displayedSrgb);
    const outOfGamut =
      activeGamut === 'display-p3'
        ? !inP3Gamut(requested)
        : !inSrgbGamut(requested);

    const displayStyles = getDisplayStyles(
      displayed,
      displayedSrgb,
      activeGamut,
    );

    return (
      <div
        {...props}
        ref={ref}
        data-color-display=""
        data-color={displayedHex}
        data-gamut={activeGamut}
        data-out-of-gamut={outOfGamut || undefined}
        role="img"
        aria-label={`Current displayed color: ${displayedHex}`}
        style={{
          ...displayStyles,
          ...style,
        }}
      />
    );
  },
);
