# Changelog

All notable changes to `color-kit` are documented here. The package is pre-1.0, so minor releases may include breaking changes.

## 0.1.0

### Breaking changes

- Packed plane query results use a strict, versioned ABI (v2). `PackedPlaneQueryResult` now carries an `abiVersion` field, and the decoder (`unpackPlaneQueryResults`) throws on unknown versions or malformed payloads instead of decoding them leniently.

### Accuracy

- Added a reference-accuracy test suite against colorjs.io, and fixed five core accuracy issues:
  - OKLab and Display P3 conversions use full-precision CSS Color 4 matrices.
  - `contrastAPCA` matches APCA-W3 0.0.98G-4g.
  - HSL/HSV hues wrap correctly, and `fromHsl`/`fromHsv` keep full precision.
  - The gamut epsilon applies to encoded channel values, not linear light.
  - `toSrgbGamut`/`toP3Gamut` map colors strictly inside the target gamut.

### Architecture

- Core is split into layered modules (conversion, gamut, plane model specs, resolve, mapping, trace, geometry), and plane query kinds are defined through a `PlaneQuerySpec` registry.
- Removed non-core tooling from the repository, including the docs Lab and component registry.

### Bundle size

- Core ships one module per source file with `"sideEffects": false`, so bundlers only include what you import, even from the root entry. `import { parse, toHex, contrastRatio } from 'color-kit'` is now about 2.3 KB minified and gzipped, down from about 15 KB.
- The default compute scheduler is created lazily, and unused parts of the bundled Material color utilities are no longer included.
- Size budgets for common imports are enforced in CI (`pnpm size`).
