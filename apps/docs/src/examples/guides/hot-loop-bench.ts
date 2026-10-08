import { toSrgbGamut, toSrgbGamutInto, type Color } from 'color-kit';
import { toSrgbArray } from 'color-kit/interop';

export interface BenchRow {
  name: string;
  /** Fastest of the runs, in nanoseconds per color. */
  nsPerColor: number;
}

/**
 * Maps `count` colors into sRGB and writes gamma-encoded floats, two ways.
 * Both produce identical numbers; only allocation differs.
 */
export function runHotLoopBench(count = 40_000, runs = 5): BenchRow[] {
  const colors: Color[] = Array.from({ length: count }, (_, i) => ({
    l: 0.2 + (0.7 * (i % 97)) / 97,
    c: 0.05 + (0.3 * (i % 89)) / 89, // many outside sRGB
    h: (i * 37) % 360,
    alpha: 1,
  }));
  const buffer = new Float32Array(count * 3);
  const scratch: Color = { l: 0, c: 0, h: 0, alpha: 1 };

  const cases: [string, () => void][] = [
    // A new mapped Color and a new tuple per color.
    [
      'toSrgbGamut + toSrgbArray',
      () => {
        for (let i = 0; i < count; i++) {
          buffer.set(toSrgbArray(toSrgbGamut(colors[i])), i * 3);
        }
      },
    ],
    // One reused Color; the tuple is written straight into the buffer.
    [
      'toSrgbGamutInto + toSrgbArray(out)',
      () => {
        for (let i = 0; i < count; i++) {
          toSrgbArray(toSrgbGamutInto(scratch, colors[i]), buffer, i * 3);
        }
      },
    ],
  ];

  return cases.map(([name, run]) => {
    let best = Infinity;
    for (let r = 0; r < runs; r++) {
      const start = performance.now();
      run();
      best = Math.min(best, performance.now() - start);
    }
    return { name, nsPerColor: (best * 1e6) / count };
  });
}
