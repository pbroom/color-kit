---
'color-kit': minor
---

**Breaking:** removed the `PlaneWithSense` type from `color-kit` and `color-kit/plane`. It described `{ ...plane, ...sense(plane) }`, but no API returned it. If you need the merged shape, use `Plane & PlaneSense`.

The compute scheduler's work budgets for gamut-boundary, chroma-band and gradient queries now follow the real sample counts. Before, any query without `steps` was assumed to have 48. Now the budgets use the solver defaults (100, 12 and 16), and adaptive sampling is estimated from `adaptiveTolerance` and `adaptiveMaxDepth` as the `maxChromaAt` searches it runs (three probes per visited segment), not the points it returns. This can change the `budget:` bucket in `schedule.bucketKey` for queries that omit `steps` or use adaptive sampling.
