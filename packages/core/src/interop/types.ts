import type { GamutTarget } from '../gamut/types.js';

/**
 * A three-component color tuple, such as linear-sRGB `[r, g, b]` or OKLab
 * `[L, a, b]`. Matches the `[r, g, b]` layout used by three.js
 * (`Color.fromArray`/`toArray`), gl-matrix style `vec3`s, and GLSL/WGSL
 * `vec3` uniforms.
 */
export type ColorTuple = [number, number, number];

/**
 * A four-component color tuple: three channels followed by alpha, such as
 * linear-sRGB `[r, g, b, a]`. Matches GLSL/WGSL `vec4` uniforms and
 * three.js `Vector4.fromArray`.
 */
export type ColorTuple4 = [number, number, number, number];

/**
 * Any indexable, writable numeric array: a `number[]`, a `ColorTuple`, or a
 * typed array such as `Float32Array` / `Float64Array`.
 */
export interface WritableArrayLike {
  readonly length: number;
  [index: number]: number;
}

/**
 * Channel layouts supported by the array interop helpers. Each name matches
 * the `to<Space>Array` / `from<Space>Array` function pair:
 *
 * - `linearSrgb`: linear-light sRGB `[r, g, b]` (three.js working space).
 * - `srgb`: gamma-encoded sRGB `[r, g, b]` in 0–1 (not 0–255).
 * - `linearP3`: linear-light Display P3 `[r, g, b]`.
 * - `p3`: gamma-encoded Display P3 `[r, g, b]` in 0–1.
 * - `oklab`: `[L, a, b]`.
 * - `oklch`: `[l, c, h]` with hue in degrees.
 */
export type ArraySpace =
  | 'linearSrgb'
  | 'srgb'
  | 'linearP3'
  | 'p3'
  | 'oklab'
  | 'oklch';

/** Out-of-gamut handling for the array writers. */
export interface ArrayWriteOptions {
  /**
   * Map the color into a gamut (chroma reduction in OKLCH, via
   * `toSrgbGamut` / `toP3Gamut`) before converting. Applies to every space,
   * including `oklab` / `oklch`. Allocates one intermediate `Color`.
   * @default undefined (no gamut mapping)
   */
  gamutMap?: GamutTarget;
  /**
   * Clip RGB channels to `[0, 1]` after conversion. Only affects the RGB
   * spaces (`linearSrgb`, `srgb`, `linearP3`, `p3`); it is a no-op for
   * `oklab` / `oklch` (use `gamutMap` there). Alpha is written unchanged.
   *
   * The default (`false`) writes unclamped floats, which is what HDR and
   * linear-light GPU pipelines expect and matches three.js, which never
   * clamps `Color` channels.
   * @default false
   */
  clamp?: boolean;
}

/** Options for {@link packColors}. */
export interface PackColorsOptions extends ArrayWriteOptions {
  /**
   * Write alpha as a fourth component after each color's three channels.
   * @default false
   */
  alpha?: boolean;
  /**
   * Distance, in array elements, between the first components of
   * consecutive colors. Must be at least 3 (or 4 with `alpha`).
   *
   * Use `stride: 4` without `alpha` for padded `vec3` arrays (WGSL
   * `array<vec3f>` has a 16-byte stride); pad lanes are left untouched.
   * Use a larger stride to interleave colors into a vertex buffer.
   * @default alpha ? 4 : 3
   */
  stride?: number;
  /**
   * Array index of the first color's first component.
   * @default 0
   */
  offset?: number;
}

/** Options for {@link unpackColors}. */
export interface UnpackColorsOptions {
  /**
   * Read alpha from the fourth component of each color. When `false`,
   * alpha is `1`.
   * @default false
   */
  alpha?: boolean;
  /**
   * Distance, in array elements, between the first components of
   * consecutive colors.
   * @default alpha ? 4 : 3
   */
  stride?: number;
  /**
   * Array index of the first color's first component.
   * @default 0
   */
  offset?: number;
  /**
   * Number of colors to read.
   * @default as many complete colors as fit after `offset`
   */
  count?: number;
}
