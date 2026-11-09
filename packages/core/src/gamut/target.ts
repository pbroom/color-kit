import { withP3Hint } from '../utils/space-hint.js';
import { GAMUT_SPECS } from './spec.js';
import type { GamutTarget } from './types.js';

/**
 * Asserts `gamut` is `undefined` (the sRGB default) or a supported
 * {@link GamutTarget} (`'srgb'`, `'display-p3'` or `'rec2020'`), narrowing
 * its type. Anything else, such as the removed `'p3'` spelling, throws
 * instead of silently mapping to sRGB.
 *
 * @param gamut - Value read from caller options or a query.
 * @param fn - Public function name used as the message prefix.
 * @throws {TypeError} When `gamut` is not `undefined`, `'srgb'`,
 *   `'display-p3'` or `'rec2020'` (including `null`). The message is
 *   `` `${fn}: unknown gamut "${gamut}"` ``; for `'p3'` it adds
 *   `'p3' is not supported; use 'display-p3'`.
 * @see {@link assertDisplayGamut}
 *
 * @example
 * ```ts
 * import { assertGamutTarget } from '@pbroom/color-kit/plane';
 *
 * assertGamutTarget('rec2020', 'render()'); // returns; narrows the type
 * assertGamutTarget('p3', 'render()');
 * // throws TypeError: render(): unknown gamut "p3". 'p3' is not supported; use 'display-p3'
 * ```
 */
export function assertGamutTarget(
  gamut: unknown,
  fn: string,
): asserts gamut is GamutTarget | undefined {
  if (
    gamut === undefined ||
    (typeof gamut === 'string' &&
      Object.prototype.hasOwnProperty.call(GAMUT_SPECS, gamut))
  ) {
    return;
  }
  throw new TypeError(withP3Hint(`${fn}: unknown gamut "${gamut}"`, gamut));
}
