---
'@color-kit/react': major
---

ContrastRegionLayer and convenience layers are now composition-first: removed region styling props and added children support. Use ContrastRegionFill as a child for filled regions.

## Breaking changes

- **ContrastRegionLayer**: Removed `renderMode`, `regionFillColor`, `regionFillOpacity`, `regionDotOpacity`, `regionDotSize`, `regionDotGap`. Use `<ContrastRegionFill />` as a child for filled region and optional dot pattern.
- **ContrastRegionLayerMetrics**: Removed `renderMode` field.
- **ContrastRegionRenderMode**: Type removed from exports.
- **GamutBoundaryLayer, ChromaBandLayer, FallbackPointsLayer**: Now extend `LayerProps` (children allowed). Children render as underlay before built-in content.

## Migration

**Before (removed):**

```tsx
<ContrastRegionLayer
  threshold={4.5}
  renderMode="region"
  regionFillColor="#c0e1ff"
  regionFillOpacity={0.14}
  regionDotOpacity={0.2}
  regionDotSize={2}
  regionDotGap={3}
/>
```

**After:**

```tsx
<ContrastRegionLayer threshold={4.5}>
  <ContrastRegionFill
    fillColor="#c0e1ff"
    fillOpacity={0.14}
    dotOpacity={0.2}
    dotSize={2}
    dotGap={3}
  />
</ContrastRegionLayer>
```

Contour-only usage is unchanged: `<ContrastRegionLayer threshold={4.5} showPathPoints />` (no children).
