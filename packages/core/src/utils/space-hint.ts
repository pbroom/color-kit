/**
 * The Display P3 identifier is `'display-p3'` everywhere. `'p3'` was removed
 * with no alias, so every runtime check that rejects an unknown space, gamut,
 * model or format shares this hint to point callers at the new spelling.
 */
const P3_HINT = "'p3' is not supported; use 'display-p3'";

/**
 * Appends the `'p3'` migration hint to `message` when `value` is the removed
 * `'p3'` spelling; otherwise returns `message` unchanged.
 */
export function withP3Hint(message: string, value: unknown): string {
  return value === 'p3' ? `${message}. ${P3_HINT}` : message;
}
