/**
 * Tuple and typed-array interop for GPU pipelines, three.js, and WebGL /
 * WebGPU.
 *
 * - `to<Space>Array(color, out?, offset?, options?)` writes three channels
 *   into any writable array-like (allocation-free when `out` is given).
 * - `to<Space>Array4` does the same with alpha as a fourth component.
 * - `from<Space>Array(array, offset?)` / `from<Space>Array4` read them back.
 * - `packColors` / `unpackColors` handle many colors in one flat buffer with
 *   a configurable stride and offset.
 *
 * Alpha uses separate `*Array4` functions rather than an `alpha` option so
 * the return type is exact (`ColorTuple` vs `ColorTuple4`), the names match
 * the GLSL/WGSL `vec3` / `vec4` (and three.js `Color` / `Vector4`) they
 * feed, and hot paths never branch on an options object.
 *
 * Spaces: `linearSrgb`, `srgb` (gamma-encoded, 0–1), `linearP3`, `p3`
 * (gamma-encoded, 0–1), `oklab`, `oklch`. Writers emit unclamped floats by
 * default; `clamp` and `gamutMap` opt in to clipping or chroma reduction.
 *
 * three.js recipe: `THREE.Color` stores linear sRGB (its default
 * `ColorManagement.workingColorSpace` is `'srgb-linear'`), so use
 * `color.fromArray(toLinearSrgbArray(c))` and
 * `fromLinearSrgbArray(color.toArray())`. `setStyle(toCss(c))` also works,
 * but quantizes to 8-bit sRGB and clips out-of-gamut values first.
 */
export type {
  ArraySpace,
  ArrayWriteOptions,
  ColorTuple,
  ColorTuple4,
  PackColorsOptions,
  UnpackColorsOptions,
  WritableArrayLike,
} from './types.js';
export {
  toLinearSrgbArray,
  toLinearSrgbArray4,
  toSrgbArray,
  toSrgbArray4,
  toLinearP3Array,
  toLinearP3Array4,
  toP3Array,
  toP3Array4,
  toOklabArray,
  toOklabArray4,
  toOklchArray,
  toOklchArray4,
} from './writers.js';
export {
  fromLinearSrgbArray,
  fromLinearSrgbArray4,
  fromSrgbArray,
  fromSrgbArray4,
  fromLinearP3Array,
  fromLinearP3Array4,
  fromP3Array,
  fromP3Array4,
  fromOklabArray,
  fromOklabArray4,
  fromOklchArray,
  fromOklchArray4,
} from './readers.js';
export { packColors, unpackColors } from './pack.js';
