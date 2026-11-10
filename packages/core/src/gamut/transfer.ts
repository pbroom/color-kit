import type { GamutTransfer } from './spec.js';

/*
 * Evaluators of a gamut's parametric transfer curve. Kept out of `spec.ts`
 * so bundles that only carry descriptors (every plane query) do not ship
 * them: only code that quantizes in a gamut's own encoding imports this.
 *
 * The arithmetic order matches `srgbToLinearChannel` /
 * `linearToSrgbChannel` and `rec2020ToLinearChannel` /
 * `linearToRec2020Channel`, so the built-in descriptors evaluate bit for
 * bit like those functions.
 */

/** Gamma-encoded channel -> linear light, mirrored through zero. */
export function decodeTransfer(t: GamutTransfer, x: number): number {
  const abs = x < 0 ? -x : x;
  if (abs <= t.d) {
    return x / t.c;
  }
  const linear = Math.pow((abs + t.b) / t.a, t.g);
  return x < 0 ? -linear : linear;
}

/** Linear-light channel -> gamma-encoded, mirrored through zero. */
export function encodeTransfer(t: GamutTransfer, y: number): number {
  const abs = y < 0 ? -y : y;
  if (abs <= t.e) {
    return t.c * y;
  }
  const encoded = t.a * Math.pow(abs, 1 / t.g) - t.b;
  return y < 0 ? -encoded : encoded;
}
