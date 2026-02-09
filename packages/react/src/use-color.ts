import { useState, useCallback, useMemo } from 'react';
import type { Color, Rgb, Hsl, Hsv, Oklch } from '@color-kit/core';
import {
  toRgb,
  toHex,
  toHsl,
  toHsv,
  toOklch,
  toCss,
  fromRgb,
  fromHsl,
  fromHsv,
  parse,
} from '@color-kit/core';

export interface UseColorOptions {
  /** Initial color value (CSS string, hex, or Color object) */
  defaultColor?: string | Color;
  /** Controlled color value */
  color?: Color;
  /** Callback when color changes */
  onChange?: (color: Color) => void;
}

export interface UseColorReturn {
  /** Current color in internal OKLCH representation */
  color: Color;
  /** Set color from a Color object */
  setColor: (color: Color) => void;
  /** Set color from a CSS string */
  setFromString: (css: string) => void;
  /** Set color from RGB values */
  setFromRgb: (rgb: Rgb) => void;
  /** Set color from HSL values */
  setFromHsl: (hsl: Hsl) => void;
  /** Set color from HSV values */
  setFromHsv: (hsv: Hsv) => void;
  /** Current color as hex string */
  hex: string;
  /** Current color as RGB */
  rgb: Rgb;
  /** Current color as HSL */
  hsl: Hsl;
  /** Current color as HSV */
  hsv: Hsv;
  /** Current color as OKLCH */
  oklch: Oklch;
  /** Get CSS string in any format */
  css: (format?: string) => string;
}

function resolveInitialColor(defaultColor?: string | Color): Color {
  if (!defaultColor) {
    // Default: vibrant blue
    return { l: 0.6, c: 0.2, h: 250, alpha: 1 };
  }
  if (typeof defaultColor === 'string') {
    return parse(defaultColor);
  }
  return defaultColor;
}

/**
 * Core hook for color state management.
 *
 * Supports controlled and uncontrolled modes:
 * - Uncontrolled: pass `defaultColor` for initial value
 * - Controlled: pass `color` and `onChange`
 */
export function useColor(options: UseColorOptions = {}): UseColorReturn {
  const { defaultColor, color: controlledColor, onChange } = options;

  const [internalColor, setInternalColor] = useState<Color>(() =>
    resolveInitialColor(defaultColor),
  );

  const isControlled = controlledColor !== undefined;
  const color = isControlled ? controlledColor : internalColor;

  const setColor = useCallback(
    (newColor: Color) => {
      if (!isControlled) {
        setInternalColor(newColor);
      }
      onChange?.(newColor);
    },
    [isControlled, onChange],
  );

  const setFromString = useCallback(
    (css: string) => {
      setColor(parse(css));
    },
    [setColor],
  );

  const setFromRgb = useCallback(
    (rgb: Rgb) => {
      setColor(fromRgb(rgb));
    },
    [setColor],
  );

  const setFromHsl = useCallback(
    (hsl: Hsl) => {
      setColor(fromHsl(hsl));
    },
    [setColor],
  );

  const setFromHsv = useCallback(
    (hsv: Hsv) => {
      setColor(fromHsv(hsv));
    },
    [setColor],
  );

  const hex = useMemo(() => toHex(color), [color]);
  const rgb = useMemo(() => toRgb(color), [color]);
  const hsl = useMemo(() => toHsl(color), [color]);
  const hsv = useMemo(() => toHsv(color), [color]);
  const oklch = useMemo(() => toOklch(color), [color]);

  const css = useCallback((format?: string) => toCss(color, format), [color]);

  return {
    color,
    setColor,
    setFromString,
    setFromRgb,
    setFromHsl,
    setFromHsv,
    hex,
    rgb,
    hsl,
    hsv,
    oklch,
    css,
  };
}
