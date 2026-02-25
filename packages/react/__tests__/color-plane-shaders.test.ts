import { describe, expect, it } from 'vitest';
import { COLOR_PLANE_FRAGMENT_SHADER_SOURCE } from '../src/color-plane-shaders.js';

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
