/**
 * Throw a `RangeError` naming `caller` unless every value is a finite number,
 * so serializers never emit `NaN` / `Infinity` into color strings.
 */
export function assertFinite(caller: string, ...values: number[]): void {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new RangeError(
        `${caller}: non-finite channel in (${values.join(', ')})`,
      );
    }
  }
}
