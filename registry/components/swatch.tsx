'use client';

import {
  forwardRef,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  toCss,
  toHex,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';
import type { GamutTarget } from '@/hooks/use-color';

export interface SwatchProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color' | 'onSelect'
> {
  color: Color;
  gamut?: GamutTarget;
  isSelected?: boolean;
  onSelect?: (color: Color) => void;
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

export const Swatch = forwardRef<HTMLDivElement, SwatchProps>(function Swatch(
  {
    color,
    gamut = 'display-p3',
    isSelected,
    onSelect,
    style,
    onClick,
    onKeyDown,
    ...props
  },
  ref,
) {
  const displayedSrgb = useMemo(() => toSrgbGamut(color), [color]);
  const displayedP3 = useMemo(() => toP3Gamut(color), [color]);
  const displayed = gamut === 'display-p3' ? displayedP3 : displayedSrgb;
  const displayedHex = useMemo(() => toHex(displayedSrgb), [displayedSrgb]);
  const outOfGamut =
    gamut === 'display-p3' ? !inP3Gamut(color) : !inSrgbGamut(color);

  const displayStyles = useMemo(
    () => getDisplayStyles(displayed, displayedSrgb, gamut),
    [displayed, displayedSrgb, gamut],
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      onSelect?.(color);
      onClick?.(e);
    },
    [color, onSelect, onClick],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.(color);
      }
      onKeyDown?.(e);
    },
    [color, onSelect, onKeyDown],
  );

  const isInteractive = !!onSelect;

  return (
    <div
      {...props}
      ref={ref}
      data-swatch=""
      data-selected={isSelected || undefined}
      data-interactive={isInteractive || undefined}
      data-color={displayedHex}
      data-gamut={gamut}
      data-out-of-gamut={outOfGamut || undefined}
      role={isInteractive ? 'button' : 'img'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? undefined : `Color ${displayedHex}`}
      onClick={isInteractive ? handleClick : onClick}
      onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
      style={{
        ...displayStyles,
        ...style,
      }}
    />
  );
});
