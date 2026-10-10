import {
  contrastRatio,
  lightnessScale,
  parse,
  toSrgbGamut,
  type Color,
} from 'color-kit';
import {
  colorToPlane,
  definePlane,
  sense,
  toSvgCompoundPath,
} from 'color-kit/plane';

const WHITE = parse('#ffffff');
const BLACK = parse('#000000');

export interface Step {
  color: Color;
  /**
   * WCAG ratios against white and black text backgrounds, measured on the
   * 8-bit hex the swatch paints so a label agrees with what is on screen.
   */
  onWhite: number;
  onBlack: number;
  /** Position on the hue's lightness × chroma plane, 0–100. */
  x: number;
  y: number;
}

/**
 * A lightness ramp at one hue and chroma, mapped into sRGB, with the
 * regions that explain which steps pass WCAG AA on white and on black.
 */
export function contrastPalette(hue: number, chroma: number, steps = 9) {
  const plane = definePlane({ fixed: { h: hue } });
  const query = sense(plane);

  // Chroma reduction keeps lightness, so a step's contrast is set by its
  // place in the ramp even where the gamut cuts chroma.
  const ramp = lightnessScale(
    { l: 0.5, c: chroma, h: hue, alpha: 1 },
    steps,
    [0.2, 0.96],
  ).map((color) => toSrgbGamut(color));

  const palette: Step[] = ramp.map((color) => {
    const { x, y } = colorToPlane(plane, color);
    return {
      color,
      onWhite: contrastRatio(color, WHITE, { precision: '8bit' }),
      onBlack: contrastRatio(color, BLACK, { precision: '8bit' }),
      x: x * 100,
      y: y * 100,
    };
  });

  const svg = (paths: { x: number; y: number }[][], closeLoop = false) =>
    toSvgCompoundPath(paths, { closeLoop, precision: 2 });

  return {
    palette,
    gamut: svg(query.gamutRegion({ gamut: 'srgb' }).visibleRegion.paths, true),
    // Everything darker than this edge passes AA as text on white…
    onWhite: svg(query.contrastRegion({ reference: WHITE, level: 'AA' }).paths),
    // …and everything lighter than this one passes on black.
    onBlack: svg(query.contrastRegion({ reference: BLACK, level: 'AA' }).paths),
  };
}
