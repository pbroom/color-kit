import { withP3Hint } from '../utils/space-hint.js';
import type { GamutTarget } from './types.js';

/**
 * Asserts `gamut` is `undefined` (the sRGB default) or a supported
 * {@link GamutTarget}. Anything else, such as the removed `'p3'` spelling,
 * throws a `TypeError` instead of silently mapping to sRGB.
 *
 * @param gamut Value read from caller options or a query.
 * @param fn Public function name used as the message prefix.
 */
export function assertGamutTarget(
  gamut: unknown,
  fn: string,
): asserts gamut is GamutTarget | undefined {
  if (gamut === undefined || gamut === 'srgb' || gamut === 'display-p3') {
    return;
  }
  throw new TypeError(withP3Hint(`${fn}: unknown gamut "${gamut}"`, gamut));
}
