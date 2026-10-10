import { mixInto, type Color, type InterpolationSpace } from 'color-kit';

/**
 * Animate between two colors every frame without allocating a Color per
 * frame: `mixInto` writes into the same `out` object each tick.
 * Returns a function that stops the loop.
 */
export function startMixIntoLoop(
  from: Color,
  to: Color,
  space: InterpolationSpace,
  onFrame: (color: Color, frame: number) => void,
): () => void {
  const out: Color = { l: 0, c: 0, h: 0, alpha: 1 };
  const options = { space };
  let frame = 0;
  let handle = 0;

  const tick = (now: number) => {
    const t = 0.5 - 0.5 * Math.cos(now / 900);
    mixInto(out, from, to, t, options);
    frame += 1;
    onFrame(out, frame);
    handle = requestAnimationFrame(tick);
  };

  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}
