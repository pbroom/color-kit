import {
  inP3Gamut,
  inSrgbGamut,
  parse,
  toCss,
  toP3Gamut,
  toSrgbGamut,
  type Color,
} from 'color-kit';

export type SwatchGamut = 'srgb' | 'display-p3';
type ColorInput = string | Color;

function toColor(input: ColorInput): Color {
  return typeof input === 'string' ? parse(input) : input;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Compact `oklch()` for labels (3 decimals for L and C, 1 for h). */
export function formatOklch(color: Color): string {
  const alpha = color.alpha < 1 ? ` / ${round(color.alpha, 3)}` : '';
  return `oklch(${round(color.l, 3)} ${round(color.c, 3)} ${round(color.h, 1)}${alpha})`;
}

function paint(color: Color, gamut: SwatchGamut): string {
  return gamut === 'srgb' ? toCss(color, 'hex') : toCss(color, 'display-p3');
}

export type GamutStatus = 'srgb' | 'p3-only' | 'out-of-p3';

export function gamutStatus(color: Color): GamutStatus {
  if (inSrgbGamut(color)) return 'srgb';
  return inP3Gamut(color) ? 'p3-only' : 'out-of-p3';
}

const GAMUT_LABELS: Record<GamutStatus, string> = {
  srgb: 'in sRGB',
  'p3-only': 'P3 only',
  'out-of-p3': 'outside P3',
};

/**
 * `<GamutBadge color="oklch(0.7 0.25 30)" />`: the smallest gamut that holds
 * a color: `in sRGB`, `P3 only`, or `outside P3`. Text, not hue, carries the
 * meaning; `data-status` is available for styling.
 */
export function GamutBadge({ color }: { color: ColorInput }) {
  const status = gamutStatus(toColor(color));
  return (
    <span className="gamut-badge" data-status={status}>
      {GAMUT_LABELS[status]}
    </span>
  );
}

/**
 * `<Swatch color requested displayed />`: color-kit's dual-state contract in
 * one chip. The left half paints the requested color; the right half paints
 * what a display in `gamut` can show. When they are the same color the chip
 * is whole.
 *
 * Contract:
 * - `color` (or its alias `requested`): the requested color, as any CSS
 *   string `parse()` accepts or a `Color`. `requested` wins if both are set.
 * - `displayed`: override the displayed half. Defaults to
 *   `toSrgbGamut(requested)` or `toP3Gamut(requested)` per `gamut`.
 * - `gamut`: the display target, `'srgb'` (default) or `'display-p3'`.
 * - `label`: optional caption above the values.
 * - Pure: computed during render with no window access, so it prerenders.
 */
export interface SwatchProps {
  color?: ColorInput;
  requested?: ColorInput;
  displayed?: ColorInput;
  gamut?: SwatchGamut;
  label?: string;
}

export function Swatch({
  color,
  requested: requestedInput,
  displayed: displayedInput,
  gamut = 'srgb',
  label,
}: SwatchProps) {
  const source = requestedInput ?? color;
  if (source == null) {
    throw new Error('<Swatch> needs a `color` or `requested` prop');
  }
  const requested = toColor(source);
  const displayed = displayedInput
    ? toColor(displayedInput)
    : gamut === 'srgb'
      ? toSrgbGamut(requested)
      : toP3Gamut(requested);
  const requestedCss = toCss(requested, 'oklch');
  const displayedCss = paint(displayed, gamut);
  const split = formatOklch(requested) !== formatOklch(displayed);

  return (
    <figure className="swatch" data-split={split || undefined}>
      <div
        className="swatch__chip"
        role="img"
        aria-label={
          split
            ? `Requested ${formatOklch(requested)}, displayed ${formatOklch(displayed)}`
            : formatOklch(requested)
        }
      >
        <span
          className="swatch__half"
          style={{ background: requestedCss }}
          title="Requested"
        />
        <span
          className="swatch__half"
          style={{ background: displayedCss }}
          title="Displayed"
        />
      </div>
      <figcaption className="swatch__caption">
        {label ? <span className="swatch__label">{label}</span> : null}
        <span className="swatch__value">
          <span className="swatch__key">requested</span>
          <code>{formatOklch(requested)}</code>
          <GamutBadge color={requested} />
        </span>
        {split ? (
          <span className="swatch__value">
            <span className="swatch__key">displayed</span>
            <code>{formatOklch(displayed)}</code>
            <span className="gamut-badge" data-status="mapped">
              {gamut === 'srgb' ? 'mapped to sRGB' : 'mapped to P3'}
            </span>
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
