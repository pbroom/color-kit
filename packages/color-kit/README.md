# color-kit

A queryable color-space engine for building color tooling. OKLCH-canonical conversion, contrast, harmony, manipulation, gamut mapping, and plane-geometry queries, with React bindings available under `@pbroom/color-kit/react`.

## Install

```bash
pnpm add @pbroom/color-kit@next
```

## Imports

```ts
import { parse, definePlane, sense } from '@pbroom/color-kit';
```

```tsx
import {
  Color,
  useColor,
  useColorPlaneRenderer,
} from '@pbroom/color-kit/react';
```

The root `@pbroom/color-kit` entry and `@pbroom/color-kit/core` expose the same core API.

Focused subpaths are available when you only need one part of the engine:

```ts
import { definePlane, sense, toSvgPath } from '@pbroom/color-kit/plane';
import { createPlaneComputeScheduler } from '@pbroom/color-kit/compute';
import { maxHctChromaForHue } from '@pbroom/color-kit/hct'; // isolates the bundled Material dependency
import { toLinearSrgbArray, packColors } from '@pbroom/color-kit/interop'; // tuples and typed arrays for GPU / three.js
```

## Bundle size

The package is side-effect free (`"sideEffects": false`) and ships one module per source file, so bundlers only include what you import, even from the root entry. For example, `import { parse, toHex, contrastRatio } from '@pbroom/color-kit'` costs roughly 5 kB minified and gzipped (a full CSS Color 4 parser, including the 148 named colors and the `color()` space matrices); the plane engine, compute scheduler, and bundled Material HCT solver are only included when you use them. Size budgets for common imports are enforced in CI with `pnpm size`.

## License

MIT. The bundled HCT solver from Material color utilities is Apache-2.0; see `THIRD_PARTY_NOTICES.md` in this package.
