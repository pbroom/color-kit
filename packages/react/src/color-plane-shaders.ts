import {
  GAMUT_LINEAR_MAX,
  GAMUT_LINEAR_MIN,
  LINEAR_SRGB_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
  OKLAB_TO_LMS,
  type Matrix3,
} from '@color-kit/core';

/**
 * Formats a number as a GLSL ES 1.00 float literal at full double precision
 * (the GPU rounds to its own float precision).
 */
export function glslFloat(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot embed non-finite GLSL constant: ${value}`);
  }
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

function glslMatrixRows(name: string, matrix: Matrix3): string {
  return matrix
    .map(
      (row, index) =>
        `  const vec3 ${name}_${index} = vec3(${row.map(glslFloat).join(', ')});`,
    )
    .join('\n');
}

export const COLOR_PLANE_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const COLOR_PLANE_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_uv;
  uniform vec4 u_seed;
  uniform vec2 u_x_range;
  uniform vec2 u_y_range;
  uniform float u_x_channel;
  uniform float u_y_channel;
  uniform float u_source;
  uniform float u_gamut;
  uniform float u_edge_behavior;

  const float PI = 3.14159265359;
  const float GAMUT_LINEAR_MIN = ${glslFloat(GAMUT_LINEAR_MIN)};
  const float GAMUT_LINEAR_MAX = ${glslFloat(GAMUT_LINEAR_MAX)};
  const int GAMUT_ITERS = 14;
${glslMatrixRows('OKLAB_TO_LMS', OKLAB_TO_LMS)}
${glslMatrixRows('LMS_TO_LINEAR_SRGB', LMS_TO_LINEAR_SRGB)}
${glslMatrixRows('LINEAR_SRGB_TO_LINEAR_P3', LINEAR_SRGB_TO_LINEAR_P3)}

  float transferLinearToSrgb(float value) {
    float absValue = abs(value);
    float srgb = absValue <= 0.0031308
      ? 12.92 * absValue
      : 1.055 * pow(absValue, 1.0 / 2.4) - 0.055;
    return clamp(sign(value) * srgb, 0.0, 1.0);
  }

  vec3 oklchToLinearSrgb(float lightness, float chroma, float hueDeg) {
    float hueRad = radians(mod(hueDeg, 360.0));
    vec3 lab = vec3(lightness, chroma * cos(hueRad), chroma * sin(hueRad));
    vec3 lmsPrime = vec3(
      dot(OKLAB_TO_LMS_0, lab),
      dot(OKLAB_TO_LMS_1, lab),
      dot(OKLAB_TO_LMS_2, lab)
    );
    vec3 lms = lmsPrime * lmsPrime * lmsPrime;
    return vec3(
      dot(LMS_TO_LINEAR_SRGB_0, lms),
      dot(LMS_TO_LINEAR_SRGB_1, lms),
      dot(LMS_TO_LINEAR_SRGB_2, lms)
    );
  }

  vec3 linearSrgbToLinearP3(vec3 linearSrgb) {
    return vec3(
      dot(LINEAR_SRGB_TO_LINEAR_P3_0, linearSrgb),
      dot(LINEAR_SRGB_TO_LINEAR_P3_1, linearSrgb),
      dot(LINEAR_SRGB_TO_LINEAR_P3_2, linearSrgb)
    );
  }

  // Same rule as core isLinearRgbInGamut: GAMUT_EPSILON of slack on the
  // gamma-encoded channels, expressed as linear-light bounds.
  bool inGamutLinear(vec3 linear) {
    return all(greaterThanEqual(linear, vec3(GAMUT_LINEAR_MIN))) &&
      all(lessThanEqual(linear, vec3(GAMUT_LINEAR_MAX)));
  }

  bool inUnitCube(vec3 linear) {
    return all(greaterThanEqual(linear, vec3(0.0))) &&
      all(lessThanEqual(linear, vec3(1.0)));
  }

  bool inSrgbGamut(vec3 linearSrgb) {
    return inGamutLinear(linearSrgb);
  }

  bool inP3Gamut(vec3 linearSrgb) {
    return inGamutLinear(linearSrgbToLinearP3(linearSrgb));
  }

  bool strictlyInTargetGamut(vec3 linearSrgb) {
    return u_gamut < 0.5
      ? inUnitCube(linearSrgb)
      : inUnitCube(linearSrgbToLinearP3(linearSrgb));
  }

  vec3 mapToGamut(float lightness, float chroma, float hueDeg) {
    vec3 rawLinear = oklchToLinearSrgb(lightness, chroma, hueDeg);
    bool targetContains = u_gamut < 0.5 ? inSrgbGamut(rawLinear) : inP3Gamut(rawLinear);
    if (targetContains) {
      return rawLinear;
    }

    // Bisect strictly inside the gamut, like core toSrgbGamut/toP3Gamut.
    float lo = 0.0;
    float hi = max(chroma, 0.0);
    float mapped = 0.0;
    for (int i = 0; i < GAMUT_ITERS; i += 1) {
      float mid = (lo + hi) * 0.5;
      vec3 testLinear = oklchToLinearSrgb(lightness, mid, hueDeg);
      if (strictlyInTargetGamut(testLinear)) {
        lo = mid;
        mapped = mid;
      } else {
        hi = mid;
      }
    }
    return oklchToLinearSrgb(lightness, mapped, hueDeg);
  }

  float applyAxisValue(float current, float axisChannel, float targetChannel, float axisValue) {
    if (abs(axisChannel - targetChannel) < 0.25) {
      return axisValue;
    }
    return current;
  }

  void main() {
    float xValue = mix(u_x_range.x, u_x_range.y, v_uv.x);
    float yValue = mix(u_y_range.x, u_y_range.y, v_uv.y);

    float l = applyAxisValue(u_seed.x, u_x_channel, 0.0, xValue);
    l = applyAxisValue(l, u_y_channel, 0.0, yValue);

    float c = applyAxisValue(u_seed.y, u_x_channel, 1.0, xValue);
    c = applyAxisValue(c, u_y_channel, 1.0, yValue);

    float h = applyAxisValue(u_seed.z, u_x_channel, 2.0, xValue);
    h = applyAxisValue(h, u_y_channel, 2.0, yValue);

    vec3 rawLinear = oklchToLinearSrgb(l, c, h);
    bool outP3 = !inP3Gamut(rawLinear);
    bool outSrgb = !outP3 && !inSrgbGamut(rawLinear);

    vec3 renderLinear = rawLinear;
    bool targetOut = u_gamut < 0.5 ? (outP3 || outSrgb) : outP3;
    bool shouldClampEdge = u_source >= 0.5 && u_edge_behavior >= 0.5;
    bool shouldClipOutOfGamut = u_source >= 0.5 && u_edge_behavior < 0.5 && targetOut;
    if (shouldClampEdge) {
      renderLinear = mapToGamut(l, c, h);
    }

    vec3 baseColor = vec3(
      transferLinearToSrgb(renderLinear.r),
      transferLinearToSrgb(renderLinear.g),
      transferLinearToSrgb(renderLinear.b)
    );
    float alpha = clamp(u_seed.w, 0.0, 1.0);

    if (shouldClipOutOfGamut) {
      baseColor = vec3(0.0);
      alpha = 0.0;
    }

    gl_FragColor = vec4(baseColor, alpha);
  }
`;
