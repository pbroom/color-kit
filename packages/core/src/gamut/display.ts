import { withP3Hint } from '../utils/space-hint.js';
import type { DisplayGamut } from './types.js';

const REC2020_HINT =
  ". 'rec2020' is a query target, not a display gamut; use 'srgb' or 'display-p3'";

/**
 * {@link assertDisplayGamut} without its `'rec2020'` sentence: the check of
 * the root-level contrast functions (`contrastRatio`, `ensureContrast`, ...),
 * whose bundles are too small to carry that sentence. Internal.
 */
export function assertDisplayGamutBare(
  gamut: unknown,
  fn: string,
): asserts gamut is DisplayGamut | undefined {
  if (gamut === undefined || gamut === 'srgb' || gamut === 'display-p3') {
    return;
  }
  throw new TypeError(withP3Hint(`${fn}: unknown gamut "${gamut}"`, gamut));
}

/**
 * Asserts `gamut` is `undefined` (the sRGB default) or a {@link DisplayGamut}
 * (`'srgb'` or `'display-p3'`), narrowing its type. Use it where a color is
 * shown rather than queried: the driver's and React's picker state accept
 * display gamuts only, so `'rec2020'` (a valid `GamutTarget`) throws here.
 * (The root-level contrast functions apply the same rule with a check whose
 * message has no `'rec2020'` sentence.)
 *
 * @param gamut - Value read from caller options or state.
 * @param fn - Public function name used as the message prefix.
 * @throws {TypeError} When `gamut` is not `undefined`, `'srgb'` or
 *   `'display-p3'` (including `null`). The message is
 *   `` `${fn}: unknown gamut "${gamut}"` ``; for `'p3'` it adds
 *   `'p3' is not supported; use 'display-p3'`, and for `'rec2020'` that it
 *   is a query target, not a display gamut.
 * @see {@link assertGamutTarget}
 *
 * @example
 * ```ts
 * import { assertDisplayGamut } from '@pbroom/color-kit/plane';
 *
 * assertDisplayGamut('display-p3', 'show()'); // returns; narrows the type
 * assertDisplayGamut('rec2020', 'show()');
 * // throws TypeError: show(): unknown gamut "rec2020". 'rec2020' is a query target, not a display gamut; use 'srgb' or 'display-p3'
 * ```
 */
export function assertDisplayGamut(
  gamut: unknown,
  fn: string,
): asserts gamut is DisplayGamut | undefined {
  if (gamut === 'rec2020') {
    throw new TypeError(`${fn}: unknown gamut "rec2020"${REC2020_HINT}`);
  }
  assertDisplayGamutBare(gamut, fn);
}
