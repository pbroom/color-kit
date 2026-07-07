// Pure numeric input helpers, semantically identical to control-kit's
// primitive-value-input math. Duplicated here (rather than imported) so the
// driver package depends only on @color-kit/core.

export type PrimitiveWrapMode = 'clamp' | 'wrap' | 'free';

export interface PrimitiveSteppedValueOptions {
  value: number;
  key: string;
  min: number;
  max: number;
  wrapMode: PrimitiveWrapMode;
  step: number;
  pageStep: number;
}

export function normalizePrimitiveValue(
  value: number,
  min: number,
  max: number,
  mode: PrimitiveWrapMode,
): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (mode === 'free' || max <= min) {
    return value;
  }

  if (mode === 'wrap') {
    if (Object.is(value, max) || Math.abs(value - max) <= 1e-12) {
      return max;
    }

    const span = max - min;
    return ((((value - min) % span) + span) % span) + min;
  }

  return Math.min(max, Math.max(min, value));
}

export function formatPrimitiveValue(
  value: number,
  precision: number,
  autoTrim: boolean,
): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const fixed = value.toFixed(precision);
  if (autoTrim) {
    const rounded = Number(fixed);
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  return fixed;
}

export function getPrimitiveSteppedValue({
  value,
  key,
  min,
  max,
  wrapMode,
  step,
  pageStep,
}: PrimitiveSteppedValueOptions): number | null {
  const safeStep = Math.abs(step);
  const safePageStep = Math.abs(pageStep);
  let nextValue: number | null = null;

  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      nextValue = value + safeStep;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      nextValue = value - safeStep;
      break;
    case 'PageUp':
      nextValue = value + safePageStep;
      break;
    case 'PageDown':
      nextValue = value - safePageStep;
      break;
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }

  return normalizePrimitiveValue(nextValue, min, max, wrapMode);
}
