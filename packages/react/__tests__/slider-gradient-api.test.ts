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

  it('defaults OKLCH hue ramps to static mode independent of baseColor', () => {
    const baseA = parse('#ff0000');
    const baseB = parse('#00ffcc');

    const stopsA = sampleSliderGradient({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: baseA,
      colorSpace: 'srgb',
      steps: 8,
    });
    const stopsB = sampleSliderGradient({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: baseB,
      colorSpace: 'srgb',
      steps: 8,
    });

    expect(stopsA.map((stop) => stop.srgbCss)).toEqual(
      stopsB.map((stop) => stop.srgbCss),
    );
  });

  it('makes static OKLCH hue ramps vary by target color space', () => {
    const base = parse('#ff0000');

    const srgb = getSliderGradientStyles({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 12,
    });
    const p3 = getSliderGradientStyles({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 12,
    });

    expect(srgb.activeBackgroundImage).not.toBe(p3.activeBackgroundImage);
  });

  it('supports selected-color hue mode for dynamic OKLCH hue ramps', () => {
    const baseA = parse('oklch(0.68 0.2 40)');
    const baseB = parse('oklch(0.38 0.08 280)');

    const stopsA = sampleSliderGradient({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: baseA,
      colorSpace: 'srgb',
      hueGradientMode: 'selected-color',
      steps: 8,
    });
    const stopsB = sampleSliderGradient({
      model: 'oklch',
      channel: 'h',
      range: [0, 360],
      baseColor: baseB,
      colorSpace: 'srgb',
      hueGradientMode: 'selected-color',
      steps: 8,
    });

    expect(stopsA[3]?.srgbCss).not.toBe(stopsB[3]?.srgbCss);
  });

  it('uses canonical static HSL and HSV hue ramps independent of baseColor', () => {
    const baseA = parse('#ff0000');
    const baseB = parse('#00ffcc');

    for (const model of ['hsl', 'hsv'] as const) {
      const stopsA = sampleSliderGradient({
        model,
        channel: 'h',
        range: [0, 360],
        baseColor: baseA,
        colorSpace: 'srgb',
        steps: 8,
      });
      const stopsB = sampleSliderGradient({
        model,
        channel: 'h',
        range: [0, 360],
        baseColor: baseB,
        colorSpace: 'srgb',
        steps: 8,
      });

      expect(stopsA.map((stop) => stop.srgbCss)).toEqual(
        stopsB.map((stop) => stop.srgbCss),
      );
    }
  });

  it('ignores hueGradientMode for non-hue channels', () => {
    const base = parse('oklch(0.72 0.19 220)');

    const defaultStyles = getSliderGradientStyles({
      model: 'oklch',
      channel: 'c',
      range: [0, 0.4],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 8,
    });
    const selectedColorModeStyles = getSliderGradientStyles({
      model: 'oklch',
      channel: 'c',
      range: [0, 0.4],
      baseColor: base,
      colorSpace: 'display-p3',
      hueGradientMode: 'selected-color',
      steps: 8,
    });

    expect(selectedColorModeStyles.activeBackgroundImage).toBe(
      defaultStyles.activeBackgroundImage,
    );
    expect(selectedColorModeStyles.srgbBackgroundImage).toBe(
      defaultStyles.srgbBackgroundImage,
    );
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

  it('supports HCT hue ramps', () => {
    const base = parse('#3b82f6');

    const stops = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 8,
    });

    expect(stops.length).toBe(9);
    expect(stops[0]?.srgbCss).toContain('rgb(');
  });

  it('defaults HCT hue ramps to static mode independent of baseColor', () => {
    const baseA = parse('#ef4444');
    const baseB = parse('#14b8a6');

    const stopsA = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: baseA,
      colorSpace: 'srgb',
      steps: 8,
    });
    const stopsB = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: baseB,
      colorSpace: 'srgb',
      steps: 8,
    });

    expect(stopsA.map((stop) => stop.srgbCss)).toEqual(
      stopsB.map((stop) => stop.srgbCss),
    );
  });

  it('supports selected-color HCT hue ramps for dynamic behavior', () => {
    const baseA = parse('oklch(0.86 0.2 80)');
    const baseB = parse('oklch(0.36 0.05 260)');

    const stopsA = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: baseA,
      colorSpace: 'srgb',
      hueGradientMode: 'selected-color',
      steps: 8,
    });
    const stopsB = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: baseB,
      colorSpace: 'srgb',
      hueGradientMode: 'selected-color',
      steps: 8,
    });

    expect(stopsA[2]?.srgbCss).not.toBe(stopsB[2]?.srgbCss);
  });

  it('produces deterministic HCT static hue ramps', () => {
    const base = parse('#8b5cf6');

    const a = getSliderGradientStyles({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 8,
    });
    const b = getSliderGradientStyles({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 8,
    });

    expect(a.activeBackgroundImage).toBe(b.activeBackgroundImage);
    expect(a.srgbBackgroundImage).toBe(b.srgbBackgroundImage);
  });

  it('keeps HCT static sampled colors consistent across colorSpace outputs', () => {
    const base = parse('#8b5cf6');

    const srgb = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'srgb',
      steps: 8,
    });
    const p3 = sampleSliderGradient({
      model: 'hct',
      channel: 'h',
      range: [0, 360],
      baseColor: base,
      colorSpace: 'display-p3',
      steps: 8,
    });

    expect(srgb.map((stop) => stop.color)).toEqual(
      p3.map((stop) => stop.color),
    );
    expect(p3[0]?.activeCss).toContain('color(display-p3');
  });
});
