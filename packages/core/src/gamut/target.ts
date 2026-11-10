import type { Gamut } from './spec.js';

/**
 * Asserts `gamut` is `undefined` (the sRGB default) or a {@link Gamut}
 * descriptor, narrowing its type. The check is by shape (a string `id` and
 * the `lmsToLinear` matrix), so custom descriptors and structured clones
 * pass.
 *
 * Gamut names such as `'display-p3'`, which earlier versions took, throw:
 * a gamut is always an imported object.
 *
 * @param gamut - Value read from caller options or a query.
 * @param fn - Public function name used as the message prefix.
 * @throws {TypeError} When `gamut` is neither `undefined` nor shaped like a
 *   `Gamut` (including strings and `null`).
 *
 * @example
 * ```ts
 * import { assertGamut, rec2020 } from '@pbroom/color-kit';
 *
 * assertGamut(rec2020, 'render()'); // returns; narrows the type
 * assertGamut('rec2020', 'render()');
 * // throws TypeError: render(): gamut "rec2020" is not a Gamut object; import one, such as displayP3
 * ```
 */
export function assertGamut(
  gamut: unknown,
  fn: string,
): asserts gamut is Gamut | undefined {
  if (
    gamut !== undefined &&
    !(
      (gamut as Partial<Gamut> | null)?.lmsToLinear &&
      typeof (gamut as Partial<Gamut>).id === 'string'
    )
  ) {
    throw new TypeError(
      `${fn}: gamut "${gamut}" is not a Gamut object; import one, such as displayP3`,
    );
  }
}
