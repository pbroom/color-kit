import type { Color } from '../types.js';
import {
  writeColor,
  writeLinearP3,
  writeLinearSrgb,
  writeOklab,
  writeOklch,
  writeP3,
  writeSrgb,
  type WriteKernel,
} from './kernels.js';
import {
  readLinearP3,
  readLinearSrgb,
  readOklab,
  readOklch,
  readP3,
  readSrgb,
  type ReadKernel,
} from './read-kernels.js';
import type {
  ArraySpace,
  PackColorsOptions,
  UnpackColorsOptions,
  WritableArrayLike,
} from './types.js';

const WRITE_KERNELS: Record<ArraySpace, WriteKernel> = {
  linearSrgb: writeLinearSrgb,
  srgb: writeSrgb,
  linearP3: writeLinearP3,
  p3: writeP3,
  oklab: writeOklab,
  oklch: writeOklch,
};

const READ_KERNELS: Record<ArraySpace, ReadKernel> = {
  linearSrgb: readLinearSrgb,
  srgb: readSrgb,
  linearP3: readLinearP3,
  p3: readP3,
  oklab: readOklab,
  oklch: readOklch,
};

function resolveLayout(
  options: { alpha?: boolean; stride?: number; offset?: number } | undefined,
  fn: string,
): { alpha: boolean; stride: number; offset: number; components: number } {
  const alpha = options?.alpha ?? false;
  const components = alpha ? 4 : 3;
  const stride = options?.stride ?? components;
  const offset = options?.offset ?? 0;
  if (!Number.isInteger(stride) || stride < components) {
    throw new RangeError(
      `${fn}: stride must be an integer >= ${components}${alpha ? ' when alpha is true' : ''}, got ${stride}`,
    );
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RangeError(
      `${fn}: offset must be a non-negative integer, got ${offset}`,
    );
  }
  return { alpha, stride, offset, components };
}

function resolveKernel<K>(table: Record<ArraySpace, K>, space: string): K {
  const kernel = Object.prototype.hasOwnProperty.call(table, space)
    ? table[space as ArraySpace]
    : undefined;
  if (kernel === undefined) {
    throw new RangeError(`Unknown array space: ${space}`);
  }
  return kernel;
}

/**
 * Write many colors into one flat array, such as a GPU vertex, uniform or
 * storage buffer. Each color occupies `stride` elements starting at
 * `offset + i * stride`: three channels of `space`, then alpha when
 * `alpha: true`. Elements between colors (padding or other interleaved
 * attributes) are left untouched.
 *
 * Values are unclamped floats by default; see `clamp`. To gamut-map, map
 * the colors before packing: `packColors(colors.map(toSrgbGamut), space)`.
 *
 * @param colors - Colors to write, in order.
 * @param space - Channel layout: `'linearSrgb'`, `'srgb'`, `'linearP3'`,
 * `'p3'`, `'oklab'` or `'oklch'`.
 * @param out - Destination. When omitted, a `Float32Array` of length
 * `offset + colors.length * stride` is allocated. Throws a `RangeError` if
 * `out` is too short, since typed arrays silently drop out-of-range writes.
 * @param options - Layout and out-of-gamut options.
 * @param options.alpha - Write alpha as a fourth component. Default `false`.
 * @param options.stride - Elements per color. Default `alpha ? 4 : 3`; use
 * `4` without alpha for WGSL `array<vec3f>` (16-byte stride) padding.
 * @param options.offset - Index of the first color's first component.
 * Default `0`.
 * @param options.clamp - Clip RGB channels to `[0, 1]`. Default `false`.
 * @returns `out`, or the newly allocated `Float32Array`.
 * @example
 * ```ts
 * // WebGPU: an array<vec4f> storage buffer of linear-sRGB colors.
 * // WGSL:  @group(0) @binding(0) var<storage, read> palette: array<vec4f>;
 * const data = packColors(colors, 'linearSrgb', undefined, { alpha: true });
 * const buffer = device.createBuffer({
 *   size: data.byteLength,
 *   usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
 * });
 * device.queue.writeBuffer(buffer, 0, data);
 *
 * // Gamut-map first when the target cannot show wide colors.
 * packColors(colors.map(toSrgbGamut), 'srgb', data, { alpha: true });
 *
 * // three.js: per-vertex colors (BufferAttribute expects linear sRGB).
 * geometry.setAttribute(
 *   'color',
 *   new THREE.BufferAttribute(packColors(colors, 'linearSrgb'), 3),
 * );
 * ```
 */
export function packColors(
  colors: readonly Color[],
  space: ArraySpace,
  out?: undefined,
  options?: PackColorsOptions,
): Float32Array;
export function packColors<T extends WritableArrayLike>(
  colors: readonly Color[],
  space: ArraySpace,
  out: T,
  options?: PackColorsOptions,
): T;
export function packColors(
  colors: readonly Color[],
  space: ArraySpace,
  out?: WritableArrayLike,
  options?: PackColorsOptions,
): WritableArrayLike {
  const { alpha, stride, offset, components } = resolveLayout(
    options,
    'packColors',
  );
  const kernel = resolveKernel(WRITE_KERNELS, space);
  const rgb = space !== 'oklab' && space !== 'oklch';
  const count = colors.length;
  const required = count === 0 ? 0 : offset + (count - 1) * stride + components;
  const target: WritableArrayLike =
    out ?? new Float32Array(offset + count * stride);
  if (target.length < required) {
    throw new RangeError(
      `packColors: output has length ${target.length}, needs at least ${required}`,
    );
  }
  for (let i = 0; i < count; i += 1) {
    writeColor(
      kernel,
      rgb,
      alpha,
      colors[i],
      target,
      offset + i * stride,
      options,
    );
  }
  return target;
}

/**
 * Read colors back out of a flat array written by {@link packColors} (or
 * any buffer with the same layout).
 *
 * @param array - Source array.
 * @param space - Channel layout of `array`.
 * @param options - Layout options.
 * @param options.alpha - Read alpha from the fourth component (otherwise
 * alpha is `1`). Default `false`.
 * @param options.stride - Elements per color. Default `alpha ? 4 : 3`.
 * @param options.offset - Index of the first color's first component.
 * Default `0`.
 * @param options.count - Colors to read. Default: every complete color that
 * fits after `offset`.
 * @returns New `Color` objects (OKLCH).
 * @example
 * ```ts
 * const packed = packColors(colors, 'oklab', undefined, { stride: 4 });
 * const restored = unpackColors(packed, 'oklab', { stride: 4 });
 * ```
 */
export function unpackColors(
  array: ArrayLike<number>,
  space: ArraySpace,
  options?: UnpackColorsOptions,
): Color[] {
  const { alpha, stride, offset, components } = resolveLayout(
    options,
    'unpackColors',
  );
  const kernel = resolveKernel(READ_KERNELS, space);
  const available =
    array.length < offset + components
      ? 0
      : Math.floor((array.length - offset - components) / stride) + 1;
  const count = options?.count ?? available;
  if (!Number.isInteger(count) || count < 0 || count > available) {
    throw new RangeError(
      `unpackColors: count must be an integer in [0, ${available}], got ${count}`,
    );
  }
  const colors: Color[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const start = offset + i * stride;
    colors[i] = kernel(array, start, alpha ? array[start + 3] : 1);
  }
  return colors;
}
