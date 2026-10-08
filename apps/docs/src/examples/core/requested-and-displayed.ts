import {
  contrastRatio,
  inP3Gamut,
  inSrgbGamut,
  parse,
  toCss,
  toHex,
  toSrgbGamut,
} from 'color-kit';

// A vivid violet: inside Display P3, outside sRGB.
const requested = parse('oklch(0.62 0.23 285)');

inSrgbGamut(requested); // →
inP3Gamut(requested); // →

// What an sRGB display can show: same lightness and hue, less chroma.
const displayed = toSrgbGamut(requested);
toCss(displayed, 'oklch'); // →
toHex(displayed); // →

// Is it readable as text on white?
contrastRatio(displayed, parse('#ffffff')); // →
