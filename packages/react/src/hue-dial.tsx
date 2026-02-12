import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorDial } from './color-dial.js';
import type { SetRequestedOptions } from './use-color.js';

export interface HueDialProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Arc start angle in degrees.
   * @default 0
   */
  startAngle?: number;
  /**
   * Arc end angle in degrees.
   * @default 360
   */
  endAngle?: number;
  /** Standalone requested color (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

/**
 * A convenience hue dial pre-configured for circular hue control.
 */
export const HueDial = forwardRef<HTMLDivElement, HueDialProps>(
  function HueDial(
    {
      startAngle = 0,
      endAngle = 360,
      requested,
      onChangeRequested,
      ...props
    },
    ref,
  ) {
    return (
      <ColorDial
        {...props}
        ref={ref}
        channel="h"
        wrap
        startAngle={startAngle}
        endAngle={endAngle}
        requested={requested}
        onChangeRequested={onChangeRequested}
        aria-label={props['aria-label'] ?? 'Hue'}
        data-hue-dial=""
      />
    );
  },
);
