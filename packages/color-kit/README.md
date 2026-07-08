# color-kit

A queryable color-space engine for building color tooling. OKLCH-canonical conversion, contrast, harmony, manipulation, gamut mapping, and plane-geometry queries, with React bindings available under `color-kit/react`.

## Install

```bash
pnpm add color-kit@next
```

## Imports

```ts
import { parse, definePlane, sense } from 'color-kit';
```

```tsx
import { Color, ColorArea, useColor } from 'color-kit/react';
```

The root `color-kit` entry and `color-kit/core` expose the same core API.
