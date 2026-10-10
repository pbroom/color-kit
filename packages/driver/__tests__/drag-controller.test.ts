import { describe, expect, it, vi } from 'vitest';
import {
  createPointerDragController,
  normalizeColorAreaPointer,
  resolveDragEpsilon,
  resolveMaxUpdateHz,
  type DragFrameScheduler,
  type DragPoint,
} from '../src/index.js';

function createFakeScheduler() {
  let time = 0;
  let nextHandle = 1;
  const frames = new Map<number, () => void>();
  const scheduler: DragFrameScheduler = {
    requestFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      frames.delete(handle as number);
    },
    now: () => time,
  };

  return {
    scheduler,
    pendingFrames: () => frames.size,
    /** Advances the clock and runs the frames queued before this call. */
    frame(advanceMs = 16.7) {
      time += advanceMs;
      const queued = [...frames.entries()];
      frames.clear();
      for (const [, callback] of queued) {
        callback();
      }
    },
  };
}

function setup(options: { maxUpdateHz?: number; dragEpsilon?: number } = {}) {
  const fake = createFakeScheduler();
  const commit = vi.fn<(point: DragPoint, info: unknown) => void>();
  const controller = createPointerDragController<DragPoint>(
    { normalize: (point) => point, commit, ...options },
    fake.scheduler,
  );
  return { ...fake, commit, controller };
}

describe('createPointerDragController', () => {
  it('force-commits on start and coalesces moves to one commit per frame', () => {
    const { controller, commit, frame } = setup();

    controller.start({ x: 0.1, y: 0.1 });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][1]).toEqual({
      forced: true,
      coalescedCount: 1,
    });

    controller.move({ x: 0.2, y: 0.2 });
    controller.move({ x: 0.3, y: 0.3 }, 4);
    expect(commit).toHaveBeenCalledTimes(1);

    frame();
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1]).toEqual([
      { x: 0.3, y: 0.3 },
      { forced: false, coalescedCount: 5 },
    ]);
  });

  it('sums coalesced samples across deferred frames until a commit', () => {
    const { controller, commit, frame } = setup({ maxUpdateHz: 20 });

    controller.start({ x: 0, y: 0 });
    controller.move({ x: 0.2, y: 0 }, 3);
    frame(16); // Over budget: deferred with its samples kept.
    controller.move({ x: 0.4, y: 0 }, 2);
    frame(40);
    expect(commit.mock.calls[1]).toEqual([
      { x: 0.4, y: 0 },
      { forced: false, coalescedCount: 5 },
    ]);

    // The count restarts after a commit.
    controller.move({ x: 0.6, y: 0 });
    frame(60);
    expect(commit.mock.calls[2][1]).toEqual({
      forced: false,
      coalescedCount: 1,
    });
  });

  it('measures dragEpsilon against getCurrentPoint when provided', () => {
    const { controller, commit, frame } = setup({ dragEpsilon: 0.05 });
    let current: DragPoint = { x: 0.5, y: 0 };
    controller.configure({ getCurrentPoint: () => current });

    controller.start({ x: 0.5, y: 0 });
    // A controlled parent moves the value to 0.9 mid-drag.
    current = { x: 0.9, y: 0 };
    // Within epsilon of the last commit, but far from the current value.
    controller.move({ x: 0.52, y: 0 });
    frame();
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0]).toEqual({ x: 0.52, y: 0 });

    // Within epsilon of the current value: skipped.
    current = { x: 0.52, y: 0 };
    controller.move({ x: 0.54, y: 0 });
    frame();
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('skips moves within dragEpsilon on both axes', () => {
    const { controller, commit, frame } = setup({ dragEpsilon: 0.05 });

    controller.start({ x: 0.5, y: 0.5 });
    controller.move({ x: 0.54, y: 0.46 });
    frame();
    expect(commit).toHaveBeenCalledTimes(1);

    controller.move({ x: 0.5, y: 0.6 });
    frame();
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('caps commits at maxUpdateHz and retries with the latest point', () => {
    const { controller, commit, frame, pendingFrames } = setup({
      maxUpdateHz: 20,
    });

    controller.start({ x: 0, y: 0 });
    controller.move({ x: 0.2, y: 0 });
    frame(16); // 16ms < 50ms budget: deferred, not dropped.
    expect(commit).toHaveBeenCalledTimes(1);
    expect(pendingFrames()).toBe(1);

    controller.move({ x: 0.4, y: 0 });
    frame(16);
    frame(16);
    expect(commit).toHaveBeenCalledTimes(1);

    frame(16); // 64ms since start.
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0]).toEqual({ x: 0.4, y: 0 });
  });

  it('force-commits the pending point on end and stops scheduling', () => {
    const { controller, commit, pendingFrames } = setup({ maxUpdateHz: 1 });

    controller.start({ x: 0, y: 0 });
    controller.move({ x: 0.9, y: 0.9 }, 2);
    controller.end();

    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1]).toEqual([
      { x: 0.9, y: 0.9 },
      { forced: true, coalescedCount: 2 },
    ]);
    expect(pendingFrames()).toBe(0);
    expect(controller.isActive()).toBe(false);

    controller.end();
    controller.move({ x: 0.1, y: 0.1 });
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('drops the pending point on cancel', () => {
    const { controller, commit, frame } = setup();

    controller.start({ x: 0, y: 0 });
    controller.move({ x: 0.5, y: 0.5 });
    controller.cancel();
    frame();

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('skips inputs that normalize to null or non-finite points', () => {
    const fake = createFakeScheduler();
    const commit = vi.fn();
    const controller = createPointerDragController<number>(
      {
        normalize: (value) =>
          value < 0 ? null : { x: value, y: Number.NaN * value },
        commit,
      },
      fake.scheduler,
    );

    controller.start(-1);
    controller.move(0.5);
    fake.frame();
    expect(commit).not.toHaveBeenCalled();
    expect(controller.isActive()).toBe(true);
  });

  it('uses reconfigured callbacks and options', () => {
    const { controller, commit, frame } = setup();
    const nextCommit = vi.fn();

    controller.start({ x: 0, y: 0 });
    controller.configure({ commit: nextCommit, dragEpsilon: 0.5 });
    controller.move({ x: 0.3, y: 0 });
    frame();
    expect(nextCommit).not.toHaveBeenCalled();

    controller.move({ x: 0.6, y: 0 });
    frame();
    expect(nextCommit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('sanitizes options', () => {
    expect(resolveMaxUpdateHz(undefined)).toBe(60);
    expect(resolveMaxUpdateHz(0)).toBe(60);
    expect(resolveMaxUpdateHz(Number.NaN)).toBe(60);
    expect(resolveMaxUpdateHz(120)).toBe(120);
    expect(resolveDragEpsilon(-1)).toBe(0.0005);
    expect(resolveDragEpsilon(0)).toBe(0);
  });
});

describe('normalizeColorAreaPointer', () => {
  const rect = { left: 10, top: 20, width: 100, height: 50 };

  it('maps client coordinates into clamped unit space', () => {
    expect(normalizeColorAreaPointer(60, 45, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizeColorAreaPointer(-100, 500, rect)).toEqual({ x: 0, y: 1 });
  });

  it('returns null for empty rects or non-finite input', () => {
    expect(normalizeColorAreaPointer(0, 0, { ...rect, width: 0 })).toBeNull();
    expect(normalizeColorAreaPointer(Number.NaN, 0, rect)).toBeNull();
  });
});
