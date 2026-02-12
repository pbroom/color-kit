import { describe, expect, it } from 'vitest';
import { parse } from '@color-kit/core';
import {
  getSliderGradientStyles,
  sampleSliderGradient,
} from '../src/api/slider-gradient.js';

describe('slider gradient api', () => {
  it('produces model-specific hue ramps (HSL hue 0 differs from OKLCH hue 0)', () => {
    const base = parse('#ff0000');

    const hslStops = sampleSliderGradient({
      model: 'hsl',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 8,
    });

    const oklchStops = sampleSliderGradient({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 8,
    });

    expect(hslStops[0].srgbCss).not.toBe(oklchStops[0].srgbCss);
  });

  it('maps custom ranges to sampled stop values', () => {
    const base = parse('#3b82f6');

    const stops = sampleSliderGradient({
      model: 'hsl',
      channel: 's',
      range: [20, 80],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 4,
    });

    expect(stops[0].value).toBeCloseTo(20, 6);
    expect(stops[stops.length - 1].value).toBeCloseTo(80, 6);
  });

  it('is deterministic and varies by target color space', () => {
    const base = parse('oklch(0.84 0.35 146)');

    const srgb = getSliderGradientStyles({
      model: 'oklch',
      channel: 'c',
      range: [0, 0.4],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 12,
    });

    const p3 = getSliderGradientStyles({
      model: 'oklch',
      channel: 'c',
      range: [0, 0.4],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 12,
    });

    const p3Again = getSliderGradientStyles({
      model: 'oklch',
      channel: 'c',
      range: [0, 0.4],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 12,
    });

    expect(srgb.activeBackgroundImage).toBe(srgb.srgbBackgroundImage);
    expect(p3.activeBackgroundImage).not.toBe(p3.srgbBackgroundImage);
    expect(p3.activeBackgroundImage).toBe(p3Again.activeBackgroundImage);
    expect(p3.srgbBackgroundImage).toBe(p3Again.srgbBackgroundImage);
  });

  it('returns explicit sRGB fallback output for display-p3 gradients', () => {
    const base = parse('#3b82f6');

    const styles = getSliderGradientStyles({
      model: 'rgb',
      channel: 'r',
      range: [0, 255],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 8,
    });

    expect(styles.colorSpace).toBe('display-p3');
    expect(styles.activeBackgroundImage).toContain('color(display-p3');
    expect(styles.srgbBackgroundImage).toContain('rgb(');
    expect(styles.srgbBackgroundColor).toContain('rgb(');
  });

  it('defaults to display-p3 output when colorSpace is omitted', () => {
    const base = parse('#3b82f6');

    const styles = getSliderGradientStyles({
      model: 'hsv',
      channel: 'v',
      range: [0, 100],
      baseColor: base,
      steps: 4,
    });

    expect(styles.colorSpace).toBe('display-p3');
  });
});
