# color-kit

Open-source primitive UI components and tooling for building color interfaces.

Built on **OKLCH** for perceptually uniform color manipulation. Headless React primitives with full accessibility support.

## Packages

| Package                                | Description                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`@color-kit/core`](./packages/core)   | Pure TypeScript color utilities — conversion, contrast, harmony, scales, manipulation, gamut mapping |
| [`@color-kit/react`](./packages/react) | Headless React primitives — color areas, sliders, swatches, inputs                                   |

## Install

```bash
# Core utilities only
pnpm add @color-kit/core

# Core + React components
pnpm add @color-kit/core @color-kit/react
```

### shadcn Registry

```bash
npx shadcn add color-area --registry color-kit
```

## Quick Start

### Core

```typescript
import {
  parse,
  toHex,
  lighten,
  contrastRatio,
  complementary,
} from '@color-kit/core';

// Parse any CSS color
const blue = parse('#3b82f6');

// Manipulate in OKLCH space
const light = lighten(blue, 0.2);
console.log(toHex(light));

// Check accessibility
const white = parse('#ffffff');
console.log(contrastRatio(blue, white)); // WCAG 2.1

// Generate harmonies
const comp = complementary(blue);
```

### React

```tsx
import { ColorProvider, ColorArea, useColor } from '@color-kit/react';

function ColorPicker() {
  return (
    <ColorProvider defaultColor="#3b82f6">
      <ColorArea style={{ width: 200, height: 200 }} />
    </ColorProvider>
  );
}
```

### Dual-State React Contract

`useColor` and `ColorProvider` expose explicit requested/displayed state:

- `requested`: canonical OKLCH user intent
- `displayed`: deterministic gamut-mapped output (`srgb` and `display-p3`)

```tsx
const color = useColor({ defaultColor: '#3b82f6' });

color.requested; // exact editable state
color.displayed; // active rendered state
color.setRequested({ l: 0.7, c: 0.2, h: 250, alpha: 1 });
```

### Multi-Color State

`useMultiColor` manages named color collections with shared gamut/view settings.

```tsx
const palette = useMultiColor({
  defaultColors: { base: '#3b82f6', accent: 'oklch(0.8 0.4 145)' },
});

palette.setChannel('accent', 'h', 220, { interaction: 'user' });
palette.setActiveGamut('srgb');
```

## Core API

### Conversion

`parse()` `toHex()` `toRgb()` `toHsl()` `toHsv()` `toOklch()` `toOklab()` `toP3()` `toCss()` `fromRgb()` `fromHex()` `fromHsl()` `fromHsv()` `fromOklch()` `fromOklab()` `fromP3()`

### Contrast

`contrastRatio()` `contrastAPCA()` `meetsAA()` `meetsAAA()` `relativeLuminance()`

### Harmony

`complementary()` `analogous()` `triadic()` `tetradic()` `splitComplementary()`

### Scale

`generateScale()` `interpolate()` `lightnessScale()`

### Manipulation

`lighten()` `darken()` `saturate()` `desaturate()` `adjustHue()` `mix()` `setAlpha()` `invert()` `grayscale()`

### Gamut

`inSrgbGamut()` `inP3Gamut()` `toSrgbGamut()` `toP3Gamut()`

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start docs dev server
pnpm dev
```

## Codex Guidance Template

Use the reusable Codex `AGENTS.md` template in this repo to bootstrap other repositories.

```bash
# From this repo
scripts/install-codex-agents.sh /path/to/other-repo

# Overwrite existing AGENTS.md (creates backup first)
scripts/install-codex-agents.sh /path/to/other-repo --force
```

## License

[MIT](./LICENSE)
