import { parse } from '../conversion/index.js';
import { definePlane, definePlaneFromColor } from './plane.js';
import type { PlaneDefinitionFor } from './types.js';

const color = parse('#7c3aed');

definePlane({
  model: 'rgb',
  x: { channel: 'r' },
  y: { channel: 'g' },
  fixed: { b: 96, alpha: 1 },
});

definePlane({
  x: { channel: 'l' },
  y: { channel: 'c' },
  fixed: { h: 280, alpha: 1 },
});

definePlaneFromColor(color, {
  model: 'hsl',
  x: { channel: 'h' },
  y: { channel: 's' },
  fixed: { l: 42 },
});

const rgbDefinition: PlaneDefinitionFor<'rgb'> = {
  model: 'rgb',
  x: { channel: 'r' },
  y: { channel: 'g' },
  fixed: { b: 128 },
};

definePlane(rgbDefinition);

definePlane({
  model: 'rgb',
  // @ts-expect-error rgb planes do not accept oklch channels
  x: { channel: 'l' },
  y: { channel: 'g' },
});

definePlane({
  model: 'rgb',
  x: { channel: 'r' },
  y: { channel: 'g' },
  fixed: {
    // @ts-expect-error rgb fixed values do not accept hue
    h: 220,
  },
});

// @ts-expect-error default oklch planes do not accept rgb channels
definePlane({
  x: { channel: 'r' },
  y: { channel: 'c' },
});
