import { describe, expect, it } from 'vitest';
import {
  GAMUT_EPSILON,
  GAMUT_LINEAR_MAX,
  GAMUT_LINEAR_MIN,
  LINEAR_SRGB_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
  OKLAB_TO_LMS,
} from '@color-kit/core';
import {
  COLOR_PLANE_FRAGMENT_SHADER_SOURCE,
  glslFloat,
} from '../src/color-plane-shaders.js';

describe('ColorPlane shaders', () => {
  it('maps y-axis values without a second inversion', () => {
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).toContain(
      'float yValue = mix(u_y_range.x, u_y_range.y, v_uv.y);',
    );
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toContain(
      'float yValue = mix(u_y_range.x, u_y_range.y, 1.0 - v_uv.y);',
    );
  });

  it('exposes edge behavior uniform for clamp vs transparent', () => {
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).toContain(
      'uniform float u_edge_behavior;',
    );
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).toContain(
      'bool shouldClipOutOfGamut = u_source >= 0.5 && u_edge_behavior < 0.5 && targetOut;',
    );
  });

  it('does not include out-of-gamut fill or pattern uniforms', () => {
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toContain(
      'uniform vec4 u_out_p3_fill;',
    );
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toContain(
      'uniform vec4 u_out_srgb_fill;',
    );
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toContain(
      'uniform vec3 u_dot_pattern;',
    );
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).toContain(
      'bool shouldClampEdge = u_source >= 0.5 && u_edge_behavior >= 0.5;',
    );
  });
});

describe('ColorPlane shader gamut constants', () => {
  function readVec3(name: string): number[] {
    const match = COLOR_PLANE_FRAGMENT_SHADER_SOURCE.match(
      new RegExp(`const vec3 ${name} = vec3\\(([^)]*)\\);`),
    );
    if (!match) throw new Error(`missing ${name}`);
    return match[1].split(',').map((value) => Number(value.trim()));
  }

  function readFloat(name: string): number {
    const match = COLOR_PLANE_FRAGMENT_SHADER_SOURCE.match(
      new RegExp(`const float ${name} = ([^;]+);`),
    );
    if (!match) throw new Error(`missing ${name}`);
    return Number(match[1]);
  }

  it.each([
    ['OKLAB_TO_LMS', OKLAB_TO_LMS],
    ['LMS_TO_LINEAR_SRGB', LMS_TO_LINEAR_SRGB],
    ['LINEAR_SRGB_TO_LINEAR_P3', LINEAR_SRGB_TO_LINEAR_P3],
  ] as const)('embeds core %s exactly', (name, matrix) => {
    matrix.forEach((row, index) => {
      expect(readVec3(`${name}_${index}`)).toEqual([...row]);
    });
  });

  it('uses the encoded-space epsilon bounds from core', () => {
    const encodedToLinear = (value: number) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    expect(readFloat('GAMUT_LINEAR_MIN')).toBe(GAMUT_LINEAR_MIN);
    expect(readFloat('GAMUT_LINEAR_MAX')).toBe(GAMUT_LINEAR_MAX);
    expect(GAMUT_LINEAR_MIN).toBeCloseTo(-GAMUT_EPSILON / 12.92, 15);
    expect(GAMUT_LINEAR_MAX).toBeCloseTo(
      encodedToLinear(1 + GAMUT_EPSILON),
      12,
    );
  });

  it('drops the stale linear-light epsilon and 10-digit matrices', () => {
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toMatch(
      /const float EPSILON\b/,
    );
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toContain('4.0767416621');
    expect(COLOR_PLANE_FRAGMENT_SHADER_SOURCE).not.toContain('0.8224621724');
  });

  it('emits valid GLSL float literals', () => {
    expect(glslFloat(1)).toBe('1.0');
    expect(glslFloat(-0)).toBe('0.0');
    expect(glslFloat(0.25)).toBe('0.25');
    expect(glslFloat(1e-7)).toBe('1e-7');
    expect(() => glslFloat(Number.NaN)).toThrow();
  });
});
