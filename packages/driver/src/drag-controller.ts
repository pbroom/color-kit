/**
 * Framework-agnostic pointer drag controller shared by ColorSlider and
 * ColorArea.
 *
 * Pointer moves are coalesced to one commit per animation frame, filtered by a
 * normalized movement epsilon, and capped at `maxUpdateHz`. Rate-limited
 * frames keep the latest point and retry on the next frame, so the most recent
 * position is never lost; `end()` force-commits any pending point.
 *
 * The controller touches no DOM globals at module scope. Frame scheduling and
 * the clock are injected (defaulting to `requestAnimationFrame` and
 * `performance.now()` resolved at call time) so it can be driven
 * deterministically in tests.
 */

/** A normalized drag position, typically `[0, 1]` on each axis. */
export interface DragPoint {
  /** Normalized x. */
  x: number;
  /** Normalized y. */
  y: number;
}

/** Metadata passed with each commit of a {@link PointerDragController}. */
export interface DragCommitInfo {
  /** True for commits that bypass epsilon/rate filtering (start, end). */
  forced: boolean;
  /** Pointer samples coalesced into this commit, summed across moves. */
  coalescedCount: number;
}

/**
 * Frame scheduling and clock used by a {@link PointerDragController}; inject
 * a manual one to drive drags deterministically in tests.
 */
export interface DragFrameScheduler {
  /** Schedules `callback` for the next frame and returns a cancel handle. */
  requestFrame: (callback: () => void) => unknown;
  /** Cancels a handle returned by `requestFrame`. */
  cancelFrame: (handle: unknown) => void;
  /** Current time in milliseconds. */
  now: () => number;
}

/** Configuration for {@link createPointerDragController}. */
export interface PointerDragControllerConfig<TInput> {
  /**
   * Maps raw input (for example client coordinates) to a normalized point.
   * Return `null` (or non-finite coordinates) to skip the input.
   */
  normalize: (input: TInput) => DragPoint | null;
  /** Applies a committed, normalized point. */
  commit: (point: DragPoint, info: DragCommitInfo) => void;
  /**
   * Maximum commits per second while dragging. Non-positive or non-finite
   * values fall back to the default.
   * @defaultValue 60
   */
  maxUpdateHz?: number;
  /**
   * Skip a move when neither axis changed by more than this normalized delta.
   * Negative or non-finite values fall back to the default.
   * @defaultValue 0.0005
   */
  dragEpsilon?: number;
  /**
   * The control's current normalized position. When provided, `dragEpsilon`
   * is measured against it rather than the last committed point, so a value
   * changed elsewhere mid-drag (for example a controlled parent clamping it)
   * does not swallow moves near the stale committed point.
   */
  getCurrentPoint?: () => DragPoint | null;
}

/** Drag session handle returned by {@link createPointerDragController}. */
export interface PointerDragController<TInput> {
  /** Replaces callbacks/options; takes effect on the next frame or call. */
  configure(config: Partial<PointerDragControllerConfig<TInput>>): void;
  /**
   * Begins a drag and force-commits the initial input. `coalescedCount`
   * (default 1) is the number of pointer samples this input represents.
   */
  start(input: TInput, coalescedCount?: number): void;
  /**
   * Queues the latest input for the next frame, replacing any queued input.
   * Ignored when inactive. `coalescedCount` defaults to 1.
   */
  move(input: TInput, coalescedCount?: number): void;
  /** Force-commits any pending input and ends the drag. */
  end(): void;
  /** Drops pending input and ends the drag without committing. */
  cancel(): void;
  /** Whether a drag is in progress. */
  isActive(): boolean;
}

/** Default cap on drag commits per second (60). */
export const DEFAULT_MAX_UPDATE_HZ = 60;
/** Default normalized movement below which a drag move is skipped (0.0005). */
export const DEFAULT_DRAG_EPSILON = 0.0005;
/** Tolerance for frame-timing jitter against the update-rate budget. */
const UPDATE_RATE_SLOP_MS = 1;

/**
 * Returns `value` when it is a finite number above 0, otherwise
 * {@link DEFAULT_MAX_UPDATE_HZ}.
 *
 * @example
 * ```ts
 * import { resolveMaxUpdateHz } from 'color-kit/driver';
 *
 * resolveMaxUpdateHz(120); // → 120
 * resolveMaxUpdateHz(0); // → 60
 * resolveMaxUpdateHz(undefined); // → 60
 * ```
 */
export function resolveMaxUpdateHz(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MAX_UPDATE_HZ;
}

/**
 * Returns `value` when it is a finite number of at least 0, otherwise
 * {@link DEFAULT_DRAG_EPSILON}.
 *
 * @example
 * ```ts
 * import { resolveDragEpsilon } from 'color-kit/driver';
 *
 * resolveDragEpsilon(0); // → 0
 * resolveDragEpsilon(-1); // → 0.0005
 * resolveDragEpsilon(undefined); // → 0.0005
 * ```
 */
export function resolveDragEpsilon(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_DRAG_EPSILON;
}

/**
 * Creates the default {@link DragFrameScheduler}: `requestAnimationFrame`
 * with a 16 ms `setTimeout` fallback, and `performance.now()` with a
 * `Date.now()` fallback. Globals are looked up on each call, so it is safe to
 * create during SSR.
 *
 * @example
 * ```ts
 * import { createDefaultFrameScheduler } from 'color-kit/driver';
 *
 * const scheduler = createDefaultFrameScheduler();
 * const handle = scheduler.requestFrame(() => console.log('frame'));
 * scheduler.cancelFrame(handle); // the callback never runs
 * ```
 */
export function createDefaultFrameScheduler(): DragFrameScheduler {
  return {
    requestFrame(callback) {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        return globalThis.requestAnimationFrame(() => callback());
      }
      return globalThis.setTimeout(callback, 16);
    },
    cancelFrame(handle) {
      if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(handle as number);
        return;
      }
      globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
    now() {
      return typeof globalThis.performance?.now === 'function'
        ? globalThis.performance.now()
        : Date.now();
    },
  };
}

function isFinitePoint(point: DragPoint | null): point is DragPoint {
  return point !== null && Number.isFinite(point.x) && Number.isFinite(point.y);
}

/**
 * Creates a framework-agnostic pointer drag controller. `start()` and `end()`
 * commit immediately; `move()` inputs are coalesced to at most one commit per
 * frame, skipped when within `dragEpsilon` of the current point, and capped at
 * `maxUpdateHz` (a rate-limited point is retried next frame, never dropped).
 * `normalize` maps raw input to a point; inputs it rejects are ignored.
 *
 * @param scheduler - Frame scheduler and clock; inject one for tests.
 * @see {@link normalizeColorAreaPointer}
 *
 * @example
 * ```ts
 * import { createPointerDragController, normalizeColorAreaPointer } from 'color-kit/driver';
 *
 * const rect = { left: 0, top: 0, width: 200, height: 100 };
 * const drag = createPointerDragController<{ clientX: number; clientY: number }>({
 *   normalize: (e) => normalizeColorAreaPointer(e.clientX, e.clientY, rect),
 *   commit: (point, info) => console.log(point, info.forced),
 * });
 * drag.start({ clientX: 50, clientY: 50 }); // logs { x: 0.25, y: 0.5 } true
 * drag.move({ clientX: 150, clientY: 25 }); // queued for the next frame
 * drag.end(); // flushes the queued move: logs { x: 0.75, y: 0.25 } true
 * ```
 */
export function createPointerDragController<TInput>(
  initialConfig: PointerDragControllerConfig<TInput>,
  scheduler: DragFrameScheduler = createDefaultFrameScheduler(),
): PointerDragController<TInput> {
  let config = { ...initialConfig };
  let active = false;
  let frameHandle: unknown = null;
  let pending: { input: TInput; coalescedCount: number } | null = null;
  let lastPoint: DragPoint | null = null;
  let lastCommitAt = Number.NEGATIVE_INFINITY;

  const cancelFrame = () => {
    if (frameHandle !== null) {
      scheduler.cancelFrame(frameHandle);
      frameHandle = null;
    }
  };

  const commitPoint = (point: DragPoint, info: DragCommitInfo) => {
    lastPoint = point;
    lastCommitAt = scheduler.now();
    config.commit(point, info);
  };

  const commitInput = (
    input: TInput,
    coalescedCount: number,
    forced: boolean,
  ) => {
    const point = config.normalize(input);
    if (!isFinitePoint(point)) {
      return;
    }
    commitPoint(point, { forced, coalescedCount });
  };

  const scheduleFrame = () => {
    if (frameHandle === null) {
      frameHandle = scheduler.requestFrame(onFrame);
    }
  };

  function onFrame() {
    frameHandle = null;
    if (!active || !pending) {
      return;
    }

    const point = config.normalize(pending.input);
    if (!isFinitePoint(point)) {
      pending = null;
      return;
    }

    const epsilon = resolveDragEpsilon(config.dragEpsilon);
    const current = config.getCurrentPoint?.() ?? null;
    const reference = isFinitePoint(current) ? current : lastPoint;
    if (
      reference &&
      Math.abs(point.x - reference.x) <= epsilon &&
      Math.abs(point.y - reference.y) <= epsilon
    ) {
      pending = null;
      return;
    }

    const minIntervalMs = 1000 / resolveMaxUpdateHz(config.maxUpdateHz);
    if (scheduler.now() + UPDATE_RATE_SLOP_MS < lastCommitAt + minIntervalMs) {
      // Over budget: keep the latest point and retry next frame.
      scheduleFrame();
      return;
    }

    const { coalescedCount } = pending;
    pending = null;
    commitPoint(point, { forced: false, coalescedCount });
  }

  return {
    configure(next) {
      config = { ...config, ...next };
    },
    start(input, coalescedCount = 1) {
      cancelFrame();
      pending = null;
      lastPoint = null;
      lastCommitAt = Number.NEGATIVE_INFINITY;
      active = true;
      commitInput(input, Math.max(1, coalescedCount), true);
    },
    move(input, coalescedCount = 1) {
      if (!active) {
        return;
      }
      // Samples from moves that have not committed yet are carried forward.
      pending = {
        input,
        coalescedCount:
          (pending?.coalescedCount ?? 0) + Math.max(1, coalescedCount),
      };
      scheduleFrame();
    },
    end() {
      cancelFrame();
      const last = pending;
      pending = null;
      const wasActive = active;
      active = false;
      if (wasActive && last) {
        commitInput(last.input, last.coalescedCount, true);
      }
    },
    cancel() {
      cancelFrame();
      pending = null;
      active = false;
    },
    isActive() {
      return active;
    },
  };
}
