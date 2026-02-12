import type { Color } from '@color-kit/core';
import { clamp, normalizeHue } from '@color-kit/core';

export type ColorWheelKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown';

export interface ColorWheelThumbPosition {
  x: number;
  y: number;
  radius: number;
}

const HUE_PRESERVE_RADIUS_EPSILON = 0.0005;

export const COLOR_WHEEL_DEFAULT_CHROMA_RANGE: [number, number] = [0, 0.4];

function resolveChromaSpan(range: [number, number]): number {
  return Math.max(0, range[1] - range[0]);
}

export function resolveColorWheelChromaRange(
  range?: [number, number],
): [number, number] {
  if (!range) {
    return COLOR_WHEEL_DEFAULT_CHROMA_RANGE;
  }

  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return COLOR_WHEEL_DEFAULT_CHROMA_RANGE;
  }

  if (max <= min) {
    return COLOR_WHEEL_DEFAULT_CHROMA_RANGE;
  }

  return [min, max];
}

export function getColorWheelThumbPosition(
  color: Color,
  chromaRange: [number, number],
): ColorWheelThumbPosition {
  const range = resolveColorWheelChromaRange(chromaRange);
  const span = resolveChromaSpan(range);
  const radius = span === 0 ? 0 : clamp((color.c - range[0]) / span, 0, 1);
  const angle = (normalizeHue(color.h) * Math.PI) / 180;

  return {
    x: clamp(0.5 + Math.cos(angle) * radius * 0.5, 0, 1),
    y: clamp(0.5 + Math.sin(angle) * radius * 0.5, 0, 1),
    radius,
  };
}

export function normalizeColorWheelPointer(
  pointerX: number,
  pointerY: number,
  startX: number,
  startY: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return { x: 0.5, y: 0.5 };
  }

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { x: 0.5, y: 0.5 };
  }

  if (width <= 0 || height <= 0) {
    return { x: 0.5, y: 0.5 };
  }

  const radius = Math.min(width, height) / 2;
  if (radius <= 0) {
    return { x: 0.5, y: 0.5 };
  }

  const centerX = startX + width / 2;
  const centerY = startY + height / 2;
  let dx = (pointerX - centerX) / radius;
  let dy = (pointerY - centerY) / radius;
  const distance = Math.hypot(dx, dy);

  if (distance > 1) {
    dx /= distance;
    dy /= distance;
  }

  return {
    x: clamp(0.5 + dx * 0.5, 0, 1),
    y: clamp(0.5 + dy * 0.5, 0, 1),
  };
}

export function colorFromColorWheelPosition(
  color: Color,
  xNorm: number,
  yNorm: number,
  chromaRange: [number, number],
): Color {
  const range = resolveColorWheelChromaRange(chromaRange);
  const span = resolveChromaSpan(range);
  const safeX = Number.isFinite(xNorm) ? xNorm : 0.5;
  const safeY = Number.isFinite(yNorm) ? yNorm : 0.5;

  let dx = (clamp(safeX, 0, 1) - 0.5) * 2;
  let dy = (clamp(safeY, 0, 1) - 0.5) * 2;
  const distance = Math.hypot(dx, dy);

  if (distance > 1) {
    dx /= distance;
    dy /= distance;
  }

  const radius = clamp(distance, 0, 1);
  const nextHue =
    radius <= HUE_PRESERVE_RADIUS_EPSILON
      ? color.h
      : normalizeHue((Math.atan2(dy, dx) * 180) / Math.PI);
  const nextChroma =
    span === 0 ? range[0] : clamp(range[0] + radius * span, range[0], range[1]);

  return {
    ...color,
    h: nextHue,
    c: nextChroma,
  };
}

export function colorFromColorWheelKey(
  color: Color,
  key: string,
  hueStep: number,
  chromaStepRatio: number,
  chromaRange: [number, number],
): Color | null {
  const range = resolveColorWheelChromaRange(chromaRange);
  const span = resolveChromaSpan(range);
  const safeHueStep = Number.isFinite(hueStep) ? Math.max(0, hueStep) : 0;
  const safeChromaRatio = Number.isFinite(chromaStepRatio)
    ? Math.max(0, chromaStepRatio)
    : 0;
  const chromaStep = span * safeChromaRatio;

  switch (key as ColorWheelKey) {
    case 'ArrowRight':
      return {
        ...color,
        h: normalizeHue(color.h + safeHueStep),
      };
    case 'ArrowLeft':
      return {
        ...color,
        h: normalizeHue(color.h - safeHueStep),
      };
    case 'ArrowUp':
      return {
        ...color,
        c: clamp(color.c + chromaStep, range[0], range[1]),
      };
    case 'ArrowDown':
      return {
        ...color,
        c: clamp(color.c - chromaStep, range[0], range[1]),
      };
    default:
      return null;
  }
}
