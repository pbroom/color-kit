"use client";

import { forwardRef, useMemo, type HTMLAttributes } from "react";
import type { Color } from "@color-kit/core";
import { toHex } from "@color-kit/core";
import { useOptionalColorContext } from "@/hooks/color-context";

export interface ColorDisplayProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  /** Standalone color value (alternative to ColorProvider) */
  color?: Color;
}

/**
 * A visual color preview that displays the current color as a background.
 *
 * Renders as a plain `<div>` — completely unstyled except for `backgroundColor`.
 * Use data attributes and CSS to style it (size, border-radius, border, etc.).
 *
 * Data attributes:
 * - `[data-color-display]` — always present
 * - `[data-color]` — hex value string of the color
 */
export const ColorDisplay = forwardRef<HTMLDivElement, ColorDisplayProps>(
  function ColorDisplay({ color: colorProp, style, ...props }, ref) {
    const context = useOptionalColorContext();

    const color = colorProp ?? context?.color;

    if (!color) {
      throw new Error(
        "ColorDisplay requires either a <ColorProvider> ancestor or an explicit color prop.",
      );
    }

    const hex = useMemo(() => toHex(color), [color]);

    return (
      <div
        {...props}
        ref={ref}
        data-color-display=""
        data-color={hex}
        role="img"
        aria-label={props["aria-label"] ?? `Color preview: ${hex}`}
        style={{
          backgroundColor: hex,
          ...style,
        }}
      />
    );
  },
);
