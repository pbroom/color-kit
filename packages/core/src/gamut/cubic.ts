export const MAX_SATURATION_SEARCH = 16;
const SATURATION_ROOT_ITERATIONS = 24;

export type CubicCoefficients = readonly [number, number, number, number];

export function evalCubic(coeffs: CubicCoefficients, x: number): number {
  const [c0, c1, c2, c3] = coeffs;
  return ((c3 * x + c2) * x + c1) * x + c0;
}

function evalCubicDerivative(coeffs: CubicCoefficients, x: number): number {
  const [, c1, c2, c3] = coeffs;
  return (3 * c3 * x + 2 * c2) * x + c1;
}

function hasOppositeSigns(a: number, b: number): boolean {
  return (a < 0 && b > 0) || (a > 0 && b < 0);
}

function getCubicDerivativeCriticalPoints(coeffs: CubicCoefficients): number[] {
  const [, c1, c2, c3] = coeffs;
  const a = 3 * c3;
  const b = 2 * c2;
  const c = c1;
  const epsilon = 1e-12;

  if (Math.abs(a) <= epsilon) {
    if (Math.abs(b) <= epsilon) {
      return [];
    }

    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -epsilon) {
    return [];
  }

  if (Math.abs(discriminant) <= epsilon) {
    return [-b / (2 * a)];
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const rootA = (-b - sqrtDiscriminant) / (2 * a);
  const rootB = (-b + sqrtDiscriminant) / (2 * a);
  return rootA < rootB ? [rootA, rootB] : [rootB, rootA];
}

function refinePositiveCubicRootInBracket(
  coeffs: CubicCoefficients,
  loStart: number,
  hiStart: number,
): number {
  let lo = loStart;
  let hi = hiStart;
  let fLo = evalCubic(coeffs, lo);
  const epsilon = 1e-12;

  if (Math.abs(fLo) <= epsilon) return lo;
  if (Math.abs(evalCubic(coeffs, hi)) <= epsilon) return hi;

  let x = (lo + hi) / 2;
  for (let index = 0; index < SATURATION_ROOT_ITERATIONS; index += 1) {
    const fX = evalCubic(coeffs, x);
    if (Math.abs(fX) <= epsilon) {
      return x;
    }

    if (hasOppositeSigns(fLo, fX)) {
      hi = x;
    } else {
      lo = x;
      fLo = fX;
    }

    const derivative = evalCubicDerivative(coeffs, x);
    if (Math.abs(derivative) > epsilon) {
      const next = x - fX / derivative;
      if (next > lo && next < hi) {
        x = next;
        continue;
      }
    }

    x = (lo + hi) / 2;
  }

  return x;
}

export function findPositiveCubicRoot(
  coeffs: CubicCoefficients,
): number | null {
  const f0 = coeffs[0];
  if (!(f0 > 0)) {
    return 0;
  }

  const bracketPoints = [0];
  for (const point of getCubicDerivativeCriticalPoints(coeffs)) {
    if (point > 0 && point < MAX_SATURATION_SEARCH) {
      bracketPoints.push(point);
    }
  }
  bracketPoints.push(MAX_SATURATION_SEARCH);

  let previous = bracketPoints[0];
  let previousValue = evalCubic(coeffs, previous);
  const zeroEpsilon = 1e-12;

  for (let index = 1; index < bracketPoints.length; index += 1) {
    const current = bracketPoints[index];
    const currentValue = evalCubic(coeffs, current);

    if (previous > 0 && Math.abs(previousValue) <= zeroEpsilon) {
      return previous;
    }

    if (current > 0 && Math.abs(currentValue) <= zeroEpsilon) {
      return current;
    }

    if (hasOppositeSigns(previousValue, currentValue)) {
      const root = refinePositiveCubicRootInBracket(coeffs, previous, current);
      return root >= 0 ? root : 0;
    }

    previous = current;
    previousValue = currentValue;
  }

  return null;
}
