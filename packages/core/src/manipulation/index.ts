import type { Color } from '../types.js';
import { clamp, normalizeHue, lerp } from '../utils/index.js';

/** Increase lightness by a relative amount (0-1) */
export function lighten(color: Color, amount: number): Color {
  return {
    ...color,
    l: clamp(color.l + amount * (1 - color.l), 0, 1),
  };
}

/** Decrease lightness by a relative amount (0-1) */
export function darken(color: Color, amount: number): Color {
  return {
    ...color,
    l: clamp(color.l - amount * color.l, 0, 1),
  };
}

/** Increase chroma by a relative amount (0-1) */
export function saturate(color: Color, amount: number): Color {
  return {
    ...color,
    c: clamp(color.c + amount * 0.4, 0, 0.4),
  };
}

/** Decrease chroma by a relative amount (0-1) */
export function desaturate(color: Color, amount: number): Color {
  return {
    ...color,
    c: clamp(color.c - amount * color.c, 0, 0.4),
  };
}

/** Adjust hue by a number of degrees */
export function adjustHue(color: Color, degrees: number): Color {
  return {
    ...color,
    h: normalizeHue(color.h + degrees),
  };
}

/** Set the alpha/opacity */
export function setAlpha(color: Color, alpha: number): Color {
  return {
    ...color,
    alpha: clamp(alpha, 0, 1),
  };
}

/**
 * Mix two colors together in OKLCH space.
 * t = 0 returns color1, t = 1 returns color2.
 * Default t = 0.5 (equal mix).
 */
export function mix(color1: Color, color2: Color, t: number = 0.5): Color {
  // Handle hue interpolation via shortest path
  let h1 = color1.h;
  let h2 = color2.h;
  const diff = h2 - h1;

  if (diff > 180) {
    h1 += 360;
  } else if (diff < -180) {
    h2 += 360;
  }

  return {
    l: lerp(color1.l, color2.l, t),
    c: lerp(color1.c, color2.c, t),
    h: normalizeHue(lerp(h1, h2, t)),
    alpha: lerp(color1.alpha, color2.alpha, t),
  };
}

/** Invert a color (complement lightness and hue) */
export function invert(color: Color): Color {
  return {
    l: 1 - color.l,
    c: color.c,
    h: normalizeHue(color.h + 180),
    alpha: color.alpha,
  };
}

/** Make a color fully grayscale (zero chroma) */
export function grayscale(color: Color): Color {
  return {
    ...color,
    c: 0,
  };
}
