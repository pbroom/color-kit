import { useEffect, useState, type RefObject } from 'react';

export interface MeasuredElementSize {
  width: number;
  height: number;
  dpr: number;
}

export interface UseMeasuredElementSizeOptions {
  /** Skip measuring entirely (e.g. when the element is conditionally rendered). */
  enabled?: boolean;
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * Measures an element's bounding rect (plus devicePixelRatio) through a
 * rAF-coalesced ResizeObserver, ignoring sub-half-pixel jitter.
 */
export function useMeasuredElementSize(
  ref: RefObject<Element | null>,
  options: UseMeasuredElementSizeOptions = {},
): MeasuredElementSize {
  const { enabled = true, initialWidth = 0, initialHeight = 0 } = options;
  const [size, setSize] = useState<MeasuredElementSize>({
    width: initialWidth,
    height: initialHeight,
    dpr: 1,
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const nextDpr = window.devicePixelRatio || 1;
      setSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5 &&
          Math.abs(current.dpr - nextDpr) < 0.01
        ) {
          return current;
        }
        return {
          width: rect.width,
          height: rect.height,
          dpr: nextDpr,
        };
      });
    };
    const schedule = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(measure);
    };

    schedule();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule);
      observer.observe(node);
      window.addEventListener('resize', schedule);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', schedule);
        if (frame !== 0) {
          window.cancelAnimationFrame(frame);
        }
      };
    }

    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [enabled, ref]);

  return size;
}
