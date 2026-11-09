# Core benchmarks

All benchmarks import the built package, so build first: `pnpm --filter @color-kit/core build`.

`bench:into`, `bench:max-chroma-for-hue`, `bench:mix-space` and `bench:overlay` print numbers for a person to read. Only the plane benchmark is gated in CI.

## Plane benchmark gate

```bash
pnpm --filter @color-kit/core bench:plane          # one run, full JSON on stdout
pnpm --filter @color-kit/core bench:plane:check    # 5 runs, compare with the baseline
pnpm --filter @color-kit/core bench:plane:update   # rewrite the baseline
```

The CI job `plane-bench` runs `bench:plane:check` and fails the build on a regression. `plane-bench.baseline.json` is the committed baseline.

### Scenarios

| Scenario              | Queries                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `boundary`            | 8 adaptive `gamutBoundary` queries (Display P3)                               |
| `contrast`            | 3 `contrastRegion` queries with default sampling                              |
| `contrastInteractive` | 3 `contrastRegion` queries with the React `useContrastRegion` sampling        |
| `compile`             | a `gamutBoundary` and a `contrastRegion` compiled to SVG path strings         |
| `gamutRegionAnalytic` | `gamutRegion` on OKLCH l×c, OKLCH h×c and HCT planes (closed-form solvers)    |
| `gamutRegionImplicit` | `gamutRegion` on OKLab and OKLCH h×l planes (scalar field + marching squares) |

### What is gated

| Metric            | What it is                                                                                                                                        | Limit                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `output.*`        | Path count, point count, and a hash of the result with every number rounded to 6 decimals                                                         | Must equal the baseline                                                                          |
| `work.*`          | Solver counters summed from `inspectPlaneQueries` traces: scalar-field samples, marching-squares cells and segments, solver points                | Must not exceed the baseline on the baseline's runtime; may exceed it by 3% on any other runtime |
| `timing.relative` | Scenario time divided by a calibration loop (2000 OKLCH → sRGB `toRgb` calls) timed in the same round; median of 15 rounds, then median of 5 runs | Fails above baseline × 1.5 on the baseline's runtime; **report-only** on any other runtime       |

"Runtime" means Node major version, OS and CPU architecture, as recorded in `recordedWith` in the baseline.

Why the limits differ by runtime:

- Work counters are identical from run to run on one runtime. Across runtimes, `Math` functions can differ in the last bit and root-finding takes a few more or fewer steps: Node 24 takes 0.6–1.5% more contrast samples than Node 20 and 22. Outputs still hash the same.
- Timing ratios are stable on one machine (the gated median moved less than ±5% over repeated checks on an idle laptop, and between −44% and +21% with every core oversubscribed). They are not portable: the same code on the same laptop gives ratios 20–40% lower on Node 22 than on Node 24. A ratio recorded on one runtime says nothing about another, so it is only enforced where it was recorded.

`gamutBoundary` queries are closed-form and record no solver counters, so `boundary` is gated on output and timing only.

Raw milliseconds are printed and uploaded but never gated.

### Making timing a hard gate in CI

Timing is enforced in CI only when the baseline was recorded on CI's runtime (Node 22, Linux, x64). To record one, download the `plane-bench-results` artifact from a CI run on `main` and promote it:

```bash
pnpm --filter @color-kit/core bench:plane:update --from /path/to/plane-bench-results.json
```

From then on CI enforces work counters exactly and timing at × 1.5, and local runs on other runtimes fall back to the 3% work tolerance with timing report-only. If CI runners turn out too noisy for the timing gate, promote with `--no-timing`: the baseline then holds no timing and timing stays report-only everywhere.

### Updating the baseline

`bench:plane:check` prints a per-scenario table and, when a result is better than the baseline, a notice asking you to tighten it. `bench:plane:update` rewrites the baseline from a fresh measurement, with these rules:

- Output and work counters are replaced with the measured values.
- A timing ratio within 5% of the committed one is left alone. A lower one is recorded. A higher one is **kept at the old value** unless you pass `--accept-slower`, so accepting an output change cannot loosen the timing gate by accident.
- It refuses to write when timing varied by more than 25% between the 5 runs (busy machine) or when output or work counters differed between runs.

Commit the baseline change in the same PR as the code that caused it, and say why in the PR description. Updating is legitimate when:

- **Tightening**: the check reported `better`. Always fine.
- **Output changed on purpose**: a fix or feature changes query geometry. Confirm the new geometry is what you intended; the hash only tells you it moved.
- **More work or slower, on purpose**: you traded speed for accuracy or correctness. Use `--accept-slower` for timing and state the trade-off.
- **Scenario added, removed or re-parameterised**, or the CI Node version changed.

It is not legitimate to update the baseline to make an unexplained failure pass. If a failure looks like noise, re-run the job first; a timing failure that survives a re-run is real.
