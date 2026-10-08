/**
 * The hero's first frame (hue 264°, where the blue gamut fold is sharpest),
 * computed in Node at build time. Imported as `./initial-frame?build`, so the
 * prerendered SVG and the hydrating client read the same JSON, and
 * `color-kit/plane` stays out of the home bundle until the live hero loads.
 */
import { queryHue } from '@/examples/plane/hero';

export default queryHue(264);
