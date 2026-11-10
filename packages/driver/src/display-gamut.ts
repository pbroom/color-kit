import { displayP3, srgb, type Gamut } from '@color-kit/core';

/**
 * Gamut a color is shown in, by name: `'srgb'` or `'display-p3'`. This is
 * the browser's display vocabulary (canvas `colorSpace`,
 * `@media (color-gamut)`), which the driver's and React's picker state use.
 *
 * Core functions take a gamut descriptor object instead; convert with
 * {@link displayGamutDescriptor}.
 */
export type DisplayGamut = 'srgb' | 'display-p3';

/**
 * Asserts `gamut` is `undefined` (the sRGB default) or a {@link DisplayGamut}
 * (`'srgb'` or `'display-p3'`), narrowing its type.
 *
 * @param gamut - Value read from caller options or state.
 * @param fn - Public function name used as the message prefix.
 * @throws {TypeError} When `gamut` is anything else (including `null` and a
 *   core gamut descriptor object). The message is
 *   `` `${fn}: unknown gamut "${gamut}"` ``; for `'p3'` it adds
 *   `'p3' is not supported; use 'display-p3'`, and for `'rec2020'` that it
 *   is not a display gamut.
 *
 * @example
 * ```ts
 * import { assertDisplayGamut } from '@pbroom/color-kit/driver';
 *
 * assertDisplayGamut('display-p3', 'show()'); // returns; narrows the type
 * assertDisplayGamut('rec2020', 'show()');
 * // throws TypeError: show(): unknown gamut "rec2020". 'rec2020' is not a display gamut; use 'srgb' or 'display-p3'
 * ```
 */
export function assertDisplayGamut(
  gamut: unknown,
  fn: string,
): asserts gamut is DisplayGamut | undefined {
  if (gamut === undefined || gamut === 'srgb' || gamut === 'display-p3') {
    return;
  }
  const name =
    typeof gamut === 'object' && gamut !== null
      ? `{ id: ${JSON.stringify((gamut as { id?: unknown }).id)} }`
      : `"${String(gamut)}"`;
  const hint =
    gamut === 'p3'
      ? ". 'p3' is not supported; use 'display-p3'"
      : gamut === 'rec2020'
        ? ". 'rec2020' is not a display gamut; use 'srgb' or 'display-p3'"
        : typeof gamut === 'object' && gamut !== null
          ? ". Display gamuts are named by string here: use 'srgb' or 'display-p3'"
          : '';
  throw new TypeError(`${fn}: unknown gamut ${name}${hint}`);
}

/**
 * Returns the core gamut descriptor of a display gamut name: `displayP3`
 * for `'display-p3'`, `srgb` for `'srgb'` and `undefined`. Use it to pass a
 * picker's display gamut to a core function, which takes descriptors.
 *
 * @param gamut - A validated display gamut name.
 * @returns The matching core `Gamut` descriptor.
 *
 * @example
 * ```ts
 * import { maxChromaAt } from '@pbroom/color-kit';
 * import { displayGamutDescriptor } from '@pbroom/color-kit/driver';
 *
 * maxChromaAt(0.6, 250, { gamut: displayGamutDescriptor('display-p3') });
 * // → 0.21923828125
 * ```
 */
export function displayGamutDescriptor(gamut: DisplayGamut | undefined): Gamut {
  return gamut === 'display-p3' ? displayP3 : srgb;
}
