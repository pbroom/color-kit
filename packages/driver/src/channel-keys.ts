/**
 * Shared keyboard stepping and value-text helpers for slider-like controls
 * (a channel slider and a 2D color-area thumb).
 */

export type ColorChannelKey = 'l' | 'c' | 'h' | 'alpha';

/** Default arrow-key step, as a ratio of the channel range. */
export const DEFAULT_STEP_RATIO = 0.01;
/** Default PageUp/PageDown (and Shift+Arrow) step, as a ratio of the range. */
export const DEFAULT_LARGE_STEP_RATIO = 0.1;

const CHANNEL_LABELS: Record<ColorChannelKey, string> = {
  l: 'Lightness',
  c: 'Chroma',
  h: 'Hue',
  alpha: 'Opacity',
};

export function getChannelLabel(channel: ColorChannelKey): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/** Lower/upper bounds of a possibly descending range. */
export function rangeBounds(range: [number, number]): [number, number] {
  return range[0] <= range[1] ? range : [range[1], range[0]];
}

/**
 * Applies a signed delta to `value` inside `range`, clamping to the range or
 * wrapping around it (hue).
 */
export function stepRangeValue(
  value: number,
  delta: number,
  range: [number, number],
  wrap: boolean,
): number {
  const [min, max] = rangeBounds(range);
  const next = value + delta;
  if (!wrap) {
    return Math.min(Math.max(next, min), max);
  }

  const span = max - min;
  if (span <= 0) {
    return min;
  }
  // Wrapping onto the start keeps hue in [min, max); 360 and 0 are the same.
  const wrapped = (((next - min) % span) + span) % span;
  return min + wrapped;
}

function trimNumber(value: number, decimals: number): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  // Avoid "-0".
  return String(rounded === 0 ? 0 : rounded);
}

/**
 * Human-readable channel value: lightness/opacity as percentages, hue in
 * degrees, chroma as a short decimal.
 */
export function formatChannelValue(
  channel: ColorChannelKey,
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  switch (channel) {
    case 'l':
    case 'alpha':
      return `${trimNumber(value * 100, 1)}%`;
    case 'h':
      return `${trimNumber(value, 0)}°`;
    case 'c':
    default:
      return trimNumber(value, 3);
  }
}

/** Default `aria-valuetext` for one channel, e.g. "Hue 213°". */
export function getChannelValueText(
  channel: ColorChannelKey,
  value: number,
): string {
  return `${getChannelLabel(channel)} ${formatChannelValue(channel, value)}`;
}
