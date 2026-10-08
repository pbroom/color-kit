import { describe, expect, it } from 'vitest';
import { parseColorInputExpression } from '../src/color-input-parser.js';
import { getColorInputPrecisionFromStep } from '../src/color-input.js';

const options = {
  currentValue: 25,
  range: [0, 100] as [number, number],
  allowExpressions: true,
};

describe('color input expression parser', () => {
  it('preserves public parser behavior for arithmetic precedence', () => {
    expect(parseColorInputExpression('10 + 5 * 2', options)).toBeCloseTo(20, 6);
    expect(parseColorInputExpression('(10 + 5) * 2', options)).toBeCloseTo(
      30,
      6,
    );
  });

  it('resolves relative expressions from the current channel value', () => {
    expect(parseColorInputExpression('+10', options)).toBeCloseTo(35, 6);
    expect(parseColorInputExpression('-10', options)).toBeCloseTo(15, 6);
    expect(parseColorInputExpression('*2', options)).toBeCloseTo(50, 6);
    expect(parseColorInputExpression('/2', options)).toBeCloseTo(12.5, 6);
  });

  it('maps percentages through the configured range', () => {
    expect(
      parseColorInputExpression('50%', {
        ...options,
        range: [20, 220],
      }),
    ).toBeCloseTo(120, 6);
    expect(
      parseColorInputExpression('50% + 10', {
        ...options,
        range: [20, 220],
      }),
    ).toBeCloseTo(130, 6);
  });

  it('treats every absolute percent as a position in an offset range', () => {
    const offset = { ...options, range: [100, 200] as [number, number] };
    expect(parseColorInputExpression('50% + 10', offset)).toBeCloseTo(160, 6);
    expect(parseColorInputExpression('10 + 50%', offset)).toBeCloseTo(160, 6);
    // Each percent maps like a lone `50%` (150), not as a span fraction
    // with `range[0]` added once to the result.
    expect(parseColorInputExpression('50% * 2', offset)).toBeCloseTo(300, 6);
    expect(parseColorInputExpression('50% + 50%', offset)).toBeCloseTo(300, 6);
    expect(parseColorInputExpression('(50% + 10) / 2', offset)).toBeCloseTo(
      80,
      6,
    );
    expect(parseColorInputExpression('10 - 50%', offset)).toBeCloseTo(-140, 6);
    // Relative input keeps percent as a fraction of the span.
    expect(
      parseColorInputExpression('+10%', { ...offset, currentValue: 150 }),
    ).toBeCloseTo(160, 6);
  });

  it('falls back to simple unit parsing when expressions are disabled', () => {
    const withoutExpressions = {
      ...options,
      allowExpressions: false,
    };

    expect(parseColorInputExpression('45deg', withoutExpressions)).toBe(45);
    expect(parseColorInputExpression('50%', withoutExpressions)).toBe(50);
    expect(parseColorInputExpression('10 + 5', withoutExpressions)).toBeNull();
  });

  it('rejects invalid or non-finite expressions', () => {
    expect(parseColorInputExpression('', options)).toBeNull();
    expect(parseColorInputExpression('10 +', options)).toBeNull();
    expect(parseColorInputExpression('10 / 0', options)).toBeNull();
    expect(parseColorInputExpression('oklch(0.5 0.2 120)', options)).toBeNull();
  });
});

describe('getColorInputPrecisionFromStep', () => {
  it('counts the decimals of ordinary steps', () => {
    expect(getColorInputPrecisionFromStep(1)).toBe(0);
    expect(getColorInputPrecisionFromStep(10)).toBe(0);
    expect(getColorInputPrecisionFromStep(2.5)).toBe(1);
    expect(getColorInputPrecisionFromStep(0.01)).toBe(2);
    expect(getColorInputPrecisionFromStep(0.005)).toBe(3);
    expect(getColorInputPrecisionFromStep(-0.25)).toBe(2);
    expect(getColorInputPrecisionFromStep(0.1 + 0.2)).toBe(1);
  });

  it('keeps decimals for tiny and exponent-notation steps', () => {
    expect(getColorInputPrecisionFromStep(1e-6)).toBe(6);
    expect(getColorInputPrecisionFromStep(2.5e-5)).toBe(6);
    expect(getColorInputPrecisionFromStep(1e-7)).toBe(6);
    expect(getColorInputPrecisionFromStep(1e-9)).toBe(6);
    expect(getColorInputPrecisionFromStep(Number.MIN_VALUE)).toBe(6);
  });

  it('defaults to 2 for zero or non-finite steps', () => {
    expect(getColorInputPrecisionFromStep(0)).toBe(2);
    expect(getColorInputPrecisionFromStep(Number.NaN)).toBe(2);
    expect(getColorInputPrecisionFromStep(Number.POSITIVE_INFINITY)).toBe(2);
  });
});
