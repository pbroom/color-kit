# color-kit

A queryable color-space engine for building color tooling.

Most color libraries convert and manipulate colors. color-kit does that too — but its core is a **queryable model of color-space geometry**: define a 2D plane through any color space, then ask it for gamut boundaries, contrast regions, and safe-color solutions as resolution-independent geometry. Everything is **OKLCH**-canonical and perceptually uniform, and the engine is plain TypeScript — no DOM, no UI framework, SVG output as path strings. React bindings ship as one consumer of the engine, not as the product.

## Packages

| Package                             | Description                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| [`color-kit`](./packages/color-kit) | Unified consumer package with the engine API at the root plus a `react` subpath |

## Stability Policy

This project is intentionally in a pre-production phase:

- Public packages stay on `0.x.y`.
- Breaking changes may land in minor releases while APIs are still settling.
- `npm` publishes use the `next` dist-tag until `1.0.0` readiness.
- CI blocks accidental `>=1.0.0` workspace package versions.

## React Baseline

- `color-kit/react` targets React `19+`.
- Workspace defaults pin React and React DOM to the latest `19.x`.
- Docs builds run the React Compiler (`babel-plugin-react-compiler`) by default.
- Repo lint enforces compiler-safe patterns (`react-hooks` recommended-latest + `react-compiler` rule).
- Decision: `color-kit/react` stays lint-enforced (not compiler-precompiled) for now, since the current `tsup` library pipeline does not run Babel compiler transforms.

## Install

```bash
pnpm add color-kit@next
```

### shadcn Registry

```bash
npx shadcn add color-area --registry color-kit
```

## Quick Start

### Plane queries (the engine)

Define a plane through a color space and query its geometry:

```ts
import { definePlane, sense, toSvgPath } from 'color-kit';

const plane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { h: 250, alpha: 1 },
});

const query = sense(plane);
const boundary = query.gamutBoundary({ gamut: 'display-p3' });
const d = toSvgPath(boundary.points); // resolution-independent SVG path
```

This is the layer that powers gamut visualizations, contrast-safe pickers, and other color tooling that needs to reason about color-space shape rather than individual colors.

### Everyday toolkit

```typescript
import { parse, toHex, lighten, contrastRatio, complementary } from 'color-kit';

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

### Driver (framework-agnostic UI logic)

`color-kit/driver` holds the interaction math that powers color UI without
depending on any framework: area/slider/input coordinate mapping, expression
parsing, slider gradient sampling, and the dual requested/displayed color
state model. Use it to drive React, Svelte, vanilla DOM, or canvas UIs alike.

```typescript
import { parse } from 'color-kit';
import * as ColorApi from 'color-kit/driver';

const state = ColorApi.createColorState(parse('#3b82f6'));

const axes = ColorApi.resolveColorAreaAxes({
  x: { channel: 'l' },
  y: { channel: 'c' },
});
const next = ColorApi.colorFromColorAreaPosition(
  state.requested,
  axes,
  0.5,
  0.25,
);

const gradient = ColorApi.getSliderGradientStyles({
  model: 'oklch',
  channel: 'h',
  baseColor: state.requested,
  range: ColorApi.resolveColorSliderRange('h'),
});
```

### React (one binding)

React components and hooks consume the same engine. Other bindings can be built on the framework-agnostic driver layer the same way.

```tsx
import { Color, ColorArea, useColor } from 'color-kit/react';

function ColorPicker() {
  return (
    <Color defaultColor="#3b82f6">
      <ColorArea style={{ width: 200, height: 200 }} />
    </Color>
  );
}
```

### Dual-State React Contract

`useColor` and `Color` expose explicit requested/displayed state:

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

### Plane Geometry

`definePlane()` `sense()` `runPlaneQuery()` `toSvgPath()` `toSvgCompoundPath()` `PlaneQueryCache()`

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

# Start docs dev server (instant; reads workspace packages from source)
pnpm dev

# Start docs dev server AND watch-build the publishable packages
# (only needed when validating the built dist output, not for normal docs/component work)
pnpm dev:full
```

## Publishing (Maintainers)

```bash
# Validate pre-production policy, then publish workspace packages to npm @next
pnpm publish:next

# Same flow without publishing artifacts
pnpm publish:next:dry
```

## Codex Guidance Template

Use the reusable Codex `AGENTS.md` template in this repo to bootstrap other repositories.

```bash
# From this repo
scripts/install-codex-agents.sh /path/to/other-repo

# Overwrite existing AGENTS.md (creates backup first)
scripts/install-codex-agents.sh /path/to/other-repo --force
```

## Agent Learnings Workflow

Agent learnings use a split model:

- `AGENTS.md` stores only the top 10 active evergreen learnings for fast agent context.
- `AGENTS.learnings.archive.md` is the full historical source of truth.

Use these commands:

```bash
# Add to archive only
pnpm agents:add -- --title "Short title" --lesson "Actionable lesson"

# Add/update archive and promote to active (keeps active list capped at 10)
pnpm agents:add -- --title "Short title" --lesson "Actionable lesson" --active

# Non-blocking checks (warnings only)
pnpm agents:check

# Strict checks (fails on warnings)
pnpm agents:check:strict
```

## License

[MIT](./LICENSE)
