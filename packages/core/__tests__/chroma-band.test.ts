import { describe, expect, it } from 'vitest';
import {
  chromaBand,
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
} from '../src/index.js';

describe('chromaBand()', () => {
  it('returns a deterministic tonal strip with bounded endpoints', () => {
    const first = chromaBand(210, 0.2, {
      mode: 'clamped',
      gamut: 'srgb',
      steps: 16,
    });
    const second = chromaBand(210, 0.2, {
      mode: 'clamped',
      gamut: 'srgb',
      steps: 16,
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(17);
    expect(first[0]?.l).toBe(0);
    expect(first[first.length - 1]?.l).toBe(1);
    expect(first[0]?.c).toBe(0);
    expect(first[first.length - 1]?.c).toBe(0);

    for (const color of first) {
      expect(color.l).toBeGreaterThanOrEqual(0);
      expect(color.l).toBeLessThanOrEqual(1);
      expect(color.h).toBe(210);
      expect(inSrgbGamut(color)).toBe(true);
    }
  });

  it('clamped mode preserves requested chroma when possible and clamps near boundaries', () => {
    const hue = 145;
    const requested = 0.14;
    const band = chromaBand(hue, requested, {
      mode: 'clamped',
      gamut: 'srgb',
      steps: 20,
    });

    let hasRequestedPoint = false;
    let hasClampedPoint = false;

    for (const point of band) {
      const max = maxChromaAt(point.l, hue, { gamut: 'srgb' });
      expect(point.c).toBeLessThanOrEqual(requested + 1e-6);
      expect(point.c).toBeLessThanOrEqual(max + 1e-6);

      if (Math.abs(point.c - requested) <= 1e-4) {
        hasRequestedPoint = true;
      }
      if (point.c < requested - 1e-4) {
        hasClampedPoint = true;
      }
    }

    expect(hasRequestedPoint).toBe(true);
    expect(hasClampedPoint).toBe(true);
  });

  it('proportional mode applies a stable requested/max ratio across the strip', () => {
    const hue = 285;
    const requested = 0.16;
    const selectedLightness = 0.62;
    const selectedMax = maxChromaAt(selectedLightness, hue, {
      gamut: 'display-p3',
    });
    const ratio = Math.min(1, requested / selectedMax);

    const band = chromaBand(hue, requested, {
      mode: 'proportional',
      gamut: 'display-p3',
      selectedLightness,
      steps: 18,
    });

    for (const point of band) {
      const max = maxChromaAt(point.l, hue, { gamut: 'display-p3' });
      expect(point.c).toBeCloseTo(ratio * max, 6);
      expect(point.c).toBeLessThanOrEqual(max + 1e-6);
      expect(inP3Gamut(point)).toBe(true);
    }
  });

  it('falls back to zero chroma when proportional mode has no chroma budget at selected lightness', () => {
    const band = chromaBand(30, 0.24, {
      mode: 'proportional',
      selectedLightness: 0,
      steps: 8,
    });

    expect(band.every((point) => point.c === 0)).toBe(true);
  });

  it('validates options and input values', () => {
    expect(() =>
      chromaBand(210, Number.NaN, {
        steps: 8,
      }),
    ).toThrow('chromaBand() requires a finite requestedChroma');

    expect(() =>
      chromaBand(210, 0.2, {
        steps: 1,
      }),
    ).toThrow('chromaBand() requires steps >= 2');

    expect(() =>
      chromaBand(210, 0.2, {
        mode: 'invalid' as unknown as 'clamped',
      }),
    ).toThrow("chromaBand() mode must be 'clamped' or 'proportional'");
  });
});
