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

export interface DragPoint {
  x: number;
  y: number;
}

export interface DragCommitInfo {
  /** True for commits that bypass epsilon/rate filtering (start, end). */
  forced: boolean;
  /** Pointer samples coalesced into this commit. */
  coalescedCount: number;
}

export interface DragFrameScheduler {
  requestFrame: (callback: () => void) => unknown;
  cancelFrame: (handle: unknown) => void;
  now: () => number;
}

export interface PointerDragControllerConfig<TInput> {
  /**
   * Maps raw input (for example client coordinates) to a normalized point.
   * Return `null` (or non-finite coordinates) to skip the input.
   */
  normalize: (input: TInput) => DragPoint | null;
  /** Applies a committed, normalized point. */
  commit: (point: DragPoint, info: DragCommitInfo) => void;
  /**
   * Maximum commits per second while dragging.
   * @default 60
   */
  maxUpdateHz?: number;
  /**
   * Skip a move when neither axis changed by more than this normalized delta.
   * @default 0.0005
   */
  dragEpsilon?: number;
}

export interface PointerDragController<TInput> {
  /** Replaces callbacks/options; takes effect on the next frame or call. */
  configure(config: Partial<PointerDragControllerConfig<TInput>>): void;
  /** Begins a drag and force-commits the initial input. */
  start(input: TInput, coalescedCount?: number): void;
  /** Queues the latest input for the next frame. Ignored when inactive. */
  move(input: TInput, coalescedCount?: number): void;
  /** Force-commits any pending input and ends the drag. */
  end(): void;
  /** Drops pending input and ends the drag without committing. */
  cancel(): void;
  /** Whether a drag is in progress. */
  isActive(): boolean;
}

export const DEFAULT_MAX_UPDATE_HZ = 60;
export const DEFAULT_DRAG_EPSILON = 0.0005;
/** Tolerance for frame-timing jitter against the update-rate budget. */
const UPDATE_RATE_SLOP_MS = 1;

export function resolveMaxUpdateHz(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MAX_UPDATE_HZ;
}

export function resolveDragEpsilon(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_DRAG_EPSILON;
}

/** Default scheduler: rAF with a timeout fallback, resolved lazily. */
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
    if (
      lastPoint &&
      Math.abs(point.x - lastPoint.x) <= epsilon &&
      Math.abs(point.y - lastPoint.y) <= epsilon
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
      pending = { input, coalescedCount: Math.max(1, coalescedCount) };
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
