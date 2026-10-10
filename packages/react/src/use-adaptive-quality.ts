import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * How eagerly {@link useAdaptiveQuality} trades detail for speed.
 * `'quality'` always stays at `'high'`; `'auto'`, `'balanced'` and
 * `'performance'` lower the level when frames are slow, with progressively
 * earlier degradation (and `'performance'` starts at `'medium'`).
 */
export type ColorPlanePerformanceProfile =
  | 'auto'
  | 'quality'
  | 'balanced'
  | 'performance';

/**
 * Detail level for the plane hooks: raster resolution in
 * {@link useColorPlaneRenderer} and sampling density in the geometry hooks
 * such as {@link useGamutBoundary}.
 */
export type ColorPlaneQualityLevel = 'high' | 'medium' | 'low';

/** One measured interaction frame, passed to `reportFrame`. */
export interface AdaptiveQualityFrame {
  /** Milliseconds spent applying the frame's update (e.g. `setRequested`). */
  updateDurationMs: number;
  /** Milliseconds since the previous frame. */
  frameTimeMs: number;
}

/** Return value of {@link useAdaptiveQuality}. */
export interface AdaptiveQuality {
  /** Current quality level; pass it to the plane hooks' `quality` option. */
  quality: ColorPlaneQualityLevel;
  /**
   * Records one frame's timing (call it from event handlers, not render) and
   * returns the quality level after adapting. The level drops one step when
   * the rolling average over the last 12 frames is slow and rises one step
   * when it recovers.
   */
  reportFrame: (frame: AdaptiveQualityFrame) => ColorPlaneQualityLevel;
  /** Clears the rolling timing window, e.g. at the start of a drag. */
  reset: () => void;
}

const WINDOW_SIZE = 12;

const DEGRADE_THRESHOLDS: Record<
  Exclude<ColorPlanePerformanceProfile, 'quality'>,
  { update: number; frame: number }
> = {
  performance: { update: 7.4, frame: 15.5 },
  balanced: { update: 8.8, frame: 18.5 },
  auto: { update: 10, frame: 20 },
};

const RECOVER_THRESHOLDS: Record<
  Exclude<ColorPlanePerformanceProfile, 'quality'>,
  { update: number; frame: number }
> = {
  performance: { update: 4.3, frame: 11.5 },
  balanced: { update: 5.2, frame: 12.5 },
  auto: { update: 5.7, frame: 13 },
};

function lowerQuality(level: ColorPlaneQualityLevel): ColorPlaneQualityLevel {
  return level === 'high' ? 'medium' : 'low';
}

function raiseQuality(level: ColorPlaneQualityLevel): ColorPlaneQualityLevel {
  return level === 'low' ? 'medium' : 'high';
}

/** Starting quality level for a performance profile. */
function profileDefaultQuality(
  profile: ColorPlanePerformanceProfile,
): ColorPlaneQualityLevel {
  return profile === 'performance' ? 'medium' : 'high';
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Adapts a {@link ColorPlaneQualityLevel} to measured interaction cost.
 *
 * Report each committed drag frame with `reportFrame`; while the rolling
 * average update or frame time is slow the level steps down (`high` →
 * `medium` → `low`), and it steps back up once frames recover. Feed
 * `quality` to {@link useColorPlaneRenderer} and the geometry hooks so a
 * slow device renders the plane at a lower resolution and samples overlays
 * more coarsely instead of dropping frames. Changing the profile resets the
 * level to the profile's default.
 *
 * @param performanceProfile - How eagerly to degrade; `'auto'` by default.
 * @returns The current level, `reportFrame` and `reset`.
 *
 * @example
 * ```tsx
 * import { useRef } from 'react';
 * import { useAdaptiveQuality } from 'color-kit/react';
 *
 * // Wrap the function a drag controller calls once per frame.
 * function useTimedCommit(commit: () => void) {
 *   const adaptive = useAdaptiveQuality('auto');
 *   const lastFrame = useRef(0);
 *   const onFrame = () => {
 *     const start = performance.now();
 *     commit();
 *     const end = performance.now();
 *     adaptive.reportFrame({
 *       updateDurationMs: end - start,
 *       frameTimeMs: lastFrame.current > 0 ? start - lastFrame.current : end - start,
 *     });
 *     lastFrame.current = start;
 *   };
 *   return { quality: adaptive.quality, onFrame };
 * }
 * ```
 */
export function useAdaptiveQuality(
  performanceProfile: ColorPlanePerformanceProfile = 'auto',
): AdaptiveQuality {
  const [state, setState] = useState<{
    profile: ColorPlanePerformanceProfile;
    level: ColorPlaneQualityLevel;
  }>(() => ({
    profile: performanceProfile,
    level: profileDefaultQuality(performanceProfile),
  }));
  // A profile change resets the stored level, so revisiting a profile used
  // earlier starts from its default instead of the level it last reached.
  if (state.profile !== performanceProfile) {
    setState({
      profile: performanceProfile,
      level: profileDefaultQuality(performanceProfile),
    });
  }
  const quality =
    state.profile === performanceProfile
      ? state.level
      : profileDefaultQuality(performanceProfile);
  const qualityRef = useRef(quality);
  const updatesRef = useRef<number[]>([]);
  const framesRef = useRef<number[]>([]);

  useEffect(() => {
    qualityRef.current = profileDefaultQuality(performanceProfile);
    updatesRef.current = [];
    framesRef.current = [];
  }, [performanceProfile]);

  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);

  const reportFrame = useCallback(
    ({ updateDurationMs, frameTimeMs }: AdaptiveQualityFrame) => {
      if (performanceProfile === 'quality') {
        qualityRef.current = 'high';
        return 'high';
      }

      const updates = updatesRef.current;
      updates.push(updateDurationMs);
      if (updates.length > WINDOW_SIZE) {
        updates.shift();
      }
      const frames = framesRef.current;
      frames.push(frameTimeMs);
      if (frames.length > WINDOW_SIZE) {
        frames.shift();
      }

      const avgUpdate = average(updates);
      const avgFrame = average(frames);
      const degrade = DEGRADE_THRESHOLDS[performanceProfile];
      const recover = RECOVER_THRESHOLDS[performanceProfile];

      let next = qualityRef.current;
      if (avgUpdate >= degrade.update || avgFrame >= degrade.frame) {
        next = lowerQuality(next);
      } else if (avgUpdate <= recover.update && avgFrame <= recover.frame) {
        next = raiseQuality(next);
      }

      if (next !== qualityRef.current) {
        qualityRef.current = next;
        setState({ profile: performanceProfile, level: next });
      }
      return next;
    },
    [performanceProfile],
  );

  const reset = useCallback(() => {
    updatesRef.current = [];
    framesRef.current = [];
  }, []);

  return useMemo(
    () => ({ quality, reportFrame, reset }),
    [quality, reportFrame, reset],
  );
}
