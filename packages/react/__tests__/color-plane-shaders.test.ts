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
});
