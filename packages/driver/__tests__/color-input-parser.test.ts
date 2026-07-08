import { describe, expect, it } from 'vitest';
import { parseColorInputExpression } from '../src/color-input-parser.js';

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
