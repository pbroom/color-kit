import { isInTargetGamut } from '../gamut/membership.js';
import type { GamutTarget } from '../gamut/types.js';
import type { Color } from '../types.js';
import {
  createContrastTest,
  firstPassingBetween,
  type ContrastTargetOptions,
} from './point-solver.js';

/**
 * Which way {@link ensureContrast} may move lightness: `'nearest'` takes the
 * smaller lightness change, `'lighter'` and `'darker'` only search that way.
 */
export type EnsureContrastDirection = 'nearest' | 'lighter' | 'darker';

/**
 * Options for {@link ensureContrast} and {@link tryEnsureContrast}: the
 * contrast target (metric, threshold and APCA options, shaped like the
 * contrast region options) plus the search direction.
 */
export interface EnsureContrastOptions extends ContrastTargetOptions {
  /**
   * Which lightness direction to search when the color does not already
   * pass. `'nearest'` searches both and returns the smaller OKLCH lightness
   * change (the lighter one on an exact tie).
   * @defaultValue `'nearest'`
   */
  direction?: EnsureContrastDirection;
}

/** Lightness steps (over the full `0`–`1` range) marched before bisecting. */
const LIGHTNESS_STEPS = 128;
/** OKLCH lightness tolerance of the solve. */
const LIGHTNESS_TOLERANCE = 1e-9;
/** OKLCH chroma tolerance of the gamut fit. */
const CHROMA_TOLERANCE = 1e-10;

/**
 * Sets `sample.c` to `chroma`, or to the largest chroma below it that is in
 * gamut at the sample's lightness and hue (bisected; zero chroma is always
 * in gamut for lightness in `[0, 1]`).
 */
function fitChroma(sample: Color, chroma: number, gamut: GamutTarget): void {
  sample.c = chroma;
  if (isInTargetGamut(sample, gamut)) return;
  let inGamut = 0;
  let outOfGamut = chroma;
  while (outOfGamut - inGamut > CHROMA_TOLERANCE) {
    sample.c = (inGamut + outOfGamut) / 2;
    if (isInTargetGamut(sample, gamut)) {
      inGamut = sample.c;
    } else {
      outOfGamut = sample.c;
    }
  }
  sample.c = inGamut;
}

/**
 * Returns the closest color to `color` that meets a contrast threshold
 * against `reference`, changing OKLCH lightness only, or `null` when no
 * lightness reaches it.
 *
 * Same search as {@link ensureContrast}, which throws instead of returning
 * `null`; see it for the details.
 *
 * @param color - Color to adjust.
 * @param reference - Color it must contrast with.
 * @param options - Contrast target, gamut and direction.
 * @returns A new Color, or `null` when the threshold is unreachable in the
 * allowed direction.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`, or
 * `direction` is not `'nearest'`, `'lighter'` or `'darker'`.
 * @throws {Error} When the threshold is out of range for the metric.
 *
 * @example
 * ```ts
 * import { parse, toHex, tryEnsureContrast } from '@pbroom/color-kit';
 *
 * const gray = parse('#808080');
 * const fixed = tryEnsureContrast(parse('#3b82f6'), gray, { level: 'AA-large' });
 * fixed && toHex(fixed); // → '#00327f'
 * tryEnsureContrast(parse('#3b82f6'), gray, { threshold: 21 }); // → null
 * ```
 */
export function tryEnsureContrast(
  color: Color,
  reference: Color,
  options: EnsureContrastOptions = {},
): Color | null {
  const gamut = options.gamut ?? 'srgb';
  const direction = options.direction ?? 'nearest';
  if (
    direction !== 'nearest' &&
    direction !== 'lighter' &&
    direction !== 'darker'
  ) {
    throw new TypeError(
      `ensureContrast(): unknown direction "${String(direction)}"`,
    );
  }
  const test = createContrastTest(
    reference,
    { ...options, gamut },
    gamut,
    'ensureContrast()',
  );
  // A powerless (non-finite) hue is measured as 0 and handed back as given.
  const sample: Color = { ...color, h: Number.isFinite(color.h) ? color.h : 0 };
  const chroma = Math.max(0, color.c);
  // The search line: the input's hue and chroma at lightness `l`, with
  // chroma reduced only as far as the gamut requires.
  const passesAt = (l: number): boolean => {
    sample.l = l;
    fitChroma(sample, chroma, gamut);
    return test.passes(sample);
  };
  const finish = (): Color => {
    sample.h = color.h;
    return sample;
  };

  const start = Math.min(1, Math.max(0, color.l));
  if (passesAt(start)) return finish();

  const solve = (end: number): number =>
    end === start
      ? Number.NaN
      : firstPassingBetween(
          passesAt,
          start,
          end,
          Math.ceil(Math.abs(end - start) * LIGHTNESS_STEPS),
          LIGHTNESS_TOLERANCE,
        );
  const lighter = direction === 'darker' ? Number.NaN : solve(1);
  const darker = direction === 'lighter' ? Number.NaN : solve(0);
  const l =
    Number.isNaN(darker) || lighter - start <= start - darker
      ? lighter
      : darker;
  if (Number.isNaN(l)) return null;
  passesAt(l);
  return finish();
}

/**
 * Returns the closest color to `color` that meets a contrast threshold
 * against `reference`, changing OKLCH lightness only.
 *
 * Hue and alpha are kept. Chroma is kept wherever the target gamut can show
 * it at the new lightness and otherwise reduced only as far as needed to
 * stay in gamut (to within `1e-10` of the gamut edge, tighter than the
 * `1e-4` of {@link toSrgbGamut} / {@link toP3Gamut}). The result is always
 * in `gamut` per {@link inSrgbGamut} / {@link inP3Gamut} and passes the same
 * check the library's metrics make: `contrastRatio(result, reference,
 * { gamut })` (or `contrastAPCA`) meets the threshold, measured unrounded.
 * A color that already passes is returned as is, with its chroma reduced
 * the same way if it was out of gamut.
 *
 * When the color fails, lightness is searched in 1/128 steps away from the
 * input in each allowed direction and the first passing step is bisected, so
 * the result is on the threshold: it passes, and the color `1e-9` of
 * lightness closer to the input does not. `'nearest'` compares the two
 * directions by OKLCH lightness change.
 *
 * Options follow the contrast region queries: `metric` (`'wcag'` by
 * default), `threshold` or a preset (`level`, default `'AA'` 4.5:1;
 * `apcaPreset`, default `'body'` Lc 60), and for APCA `apcaPolarity` and
 * `apcaRole` (`'sample-text'` by default: `color` is the text and
 * `reference` the background).
 *
 * @param color - Color to adjust.
 * @param reference - Color it must contrast with.
 * @param options - Contrast target, gamut (`'srgb'` by default) and
 * direction (`'nearest'` by default).
 * @returns A new Color.
 * @throws {RangeError} When no lightness in the allowed direction reaches
 * the threshold; use {@link tryEnsureContrast} to get `null` instead.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`, or
 * `direction` is not `'nearest'`, `'lighter'` or `'darker'`.
 * @throws {Error} When the threshold is out of range for the metric.
 * @see {@link contrastRatio}
 * @see {@link contrastAPCA}
 *
 * @example
 * ```ts
 * import { contrastRatio, ensureContrast, parse, toHex } from '@pbroom/color-kit';
 *
 * const blue = parse('#3b82f6');
 * const white = parse('#ffffff');
 * contrastRatio(blue, white); // → ≈ 3.68, fails AA
 * const text = ensureContrast(blue, white);
 * toHex(text); // → '#2c72e5'
 * contrastRatio(text, white); // → ≈ 4.5
 * toHex(ensureContrast(blue, white, { metric: 'apca', threshold: 0.75 })); // → '#2168da'
 * ensureContrast(blue, white, { direction: 'lighter' });
 * // throws RangeError: ensureContrast(): no lighter color reaches the contrast threshold
 * ```
 */
export function ensureContrast(
  color: Color,
  reference: Color,
  options: EnsureContrastOptions = {},
): Color {
  const result = tryEnsureContrast(color, reference, options);
  if (result === null) {
    const direction = options.direction ?? 'nearest';
    throw new RangeError(
      `ensureContrast(): no ${direction === 'nearest' ? 'lightness' : direction + ' color'} reaches the contrast threshold`,
    );
  }
  return result;
}
