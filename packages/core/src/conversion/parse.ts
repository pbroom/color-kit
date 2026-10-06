/**
 * CSS color string parser.
 *
 * The input is split into a function name and its component tokens, and every
 * token is validated against the CSS `<number>` grammar before conversion, so
 * malformed input throws instead of producing `NaN` channels.
 */

import type { Color } from '../types.js';
import { clamp } from '../utils/index.js';
import { hslToRgbUnrounded } from './hsl.js';
import { fromP3Into, fromRgbInto } from './into.js';
import { oklabToOklchInto } from './oklch.js';
import { hexToRgb } from './srgb.js';

/** CSS `<number>` with an optional unit suffix. */
const TOKEN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(%|deg)?$/;

/** Component token kinds. */
const NUMBER = 0; // number only
const NUMBER_OR_PERCENT = 1; // number, or percentage scaled to `scale`
const PERCENT = 2; // percentage only, scaled to `scale`
const HUE = 3; // number or `deg`

function fail(input: string, reason = ''): never {
  throw new Error(`Unable to parse color: "${input}"${reason}`);
}

/**
 * Parse one component token. Throws for malformed numbers, units the
 * component does not accept, and values that overflow to `Infinity`.
 */
function component(
  input: string,
  token: string | undefined,
  kind: number,
  scale = 1,
): number {
  const match = token ? TOKEN.exec(token) : null;
  if (!match) fail(input);
  const unit = match[2];
  if (
    unit === '%'
      ? kind !== NUMBER_OR_PERCENT && kind !== PERCENT
      : unit
        ? kind !== HUE
        : kind === PERCENT
  ) {
    fail(input);
  }
  const value = +match[1];
  if (!Number.isFinite(value)) fail(input, ' (non-finite component)');
  return unit === '%' ? (value / 100) * scale : value;
}

/**
 * Parse a CSS color string into a Color.
 * Supports: hex, rgb(), hsl(), oklch(), oklab(), color(display-p3 ...)
 *
 * Throws an `Error` for anything else, including invalid hex digits or
 * lengths, malformed numbers (`1.2.3`) and components that overflow to
 * `Infinity`; a non-string `input` throws a `TypeError`. Use {@link tryParse}
 * to get `null` instead of an exception.
 */
export function parse(input: string): Color {
  const str = input.trim().toLowerCase();

  if (str[0] === '#') {
    try {
      return fromRgbInto({ l: 0, c: 0, h: 0, alpha: 1 }, hexToRgb(str));
    } catch {
      fail(input);
    }
  }

  const fn = /^(rgba?|hsla?|oklch|oklab|color)\((.*)\)$/.exec(str);
  if (!fn) fail(input);
  const name = fn[1];
  const body = fn[2].trim();
  const legacy = name[0] === 'r' || name[0] === 'h';

  let parts: string[];
  let alphaToken: string | undefined;
  if (body.includes(',')) {
    // Legacy comma syntax: `rgb(r, g, b[, a])`, `hsl(h, s, l[, a])`.
    if (!legacy) fail(input);
    parts = body.split(',').map((part) => part.trim());
    if (parts.length === 4) alphaToken = parts.pop();
  } else {
    const slash = body.split('/');
    if (slash.length > 2) fail(input);
    parts = slash[0].trim().split(/\s+/);
    if (slash.length === 2) alphaToken = slash[1].trim();
  }

  if (name === 'color' && parts.shift() !== 'display-p3') fail(input);
  if (parts.length !== 3) fail(input);

  const alpha =
    alphaToken === undefined
      ? 1
      : clamp(component(input, alphaToken, NUMBER_OR_PERCENT), 0, 1);
  const [a, b, c] = parts;
  const out: Color = { l: 0, c: 0, h: 0, alpha };

  switch (name) {
    case 'rgb':
    case 'rgba':
      return fromRgbInto(out, {
        r: clamp(component(input, a, NUMBER), 0, 255),
        g: clamp(component(input, b, NUMBER), 0, 255),
        b: clamp(component(input, c, NUMBER), 0, 255),
        alpha,
      });
    case 'hsl':
    case 'hsla':
      return fromRgbInto(
        out,
        hslToRgbUnrounded({
          h: component(input, a, HUE),
          s: component(input, b, PERCENT, 100),
          l: component(input, c, PERCENT, 100),
          alpha,
        }),
      );
    case 'oklch':
      out.l = component(input, a, NUMBER_OR_PERCENT);
      out.c = component(input, b, NUMBER_OR_PERCENT, 0.4);
      out.h = component(input, c, HUE);
      return out;
    case 'oklab':
      return oklabToOklchInto(out, {
        L: component(input, a, NUMBER_OR_PERCENT),
        a: component(input, b, NUMBER_OR_PERCENT, 0.4),
        b: component(input, c, NUMBER_OR_PERCENT, 0.4),
        alpha,
      });
    default:
      return fromP3Into(out, {
        r: component(input, a, NUMBER),
        g: component(input, b, NUMBER),
        b: component(input, c, NUMBER),
        alpha,
      });
  }
}

/**
 * Like {@link parse}, but returns `null` instead of throwing when `input` is
 * not a supported, well-formed CSS color. Never throws.
 *
 * @example
 * ```ts
 * tryParse('#3b82f6'); // Color
 * tryParse('#gggggg'); // null
 * ```
 */
export function tryParse(input: string): Color | null {
  try {
    return parse(input);
  } catch {
    return null;
  }
}
