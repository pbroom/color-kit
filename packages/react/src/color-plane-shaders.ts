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
  uniform float u_repeat_edge_pixels;
  uniform vec4 u_out_p3_fill;
  uniform vec4 u_out_srgb_fill;
  uniform vec3 u_dot_pattern;

  const float PI = 3.14159265359;
  const float EPSILON = 0.000075;
  const int GAMUT_ITERS = 14;

  float transferLinearToSrgb(float value) {
    float absValue = abs(value);
    float srgb = absValue <= 0.0031308
      ? 12.92 * absValue
      : 1.055 * pow(absValue, 1.0 / 2.4) - 0.055;
    return clamp(sign(value) * srgb, 0.0, 1.0);
  }

  vec3 oklchToLinearSrgb(float lightness, float chroma, float hueDeg) {
    float hueRad = radians(mod(hueDeg, 360.0));
    float a = chroma * cos(hueRad);
    float b = chroma * sin(hueRad);

    float l_ = lightness + 0.3963377774 * a + 0.2158037573 * b;
    float m_ = lightness - 0.1055613458 * a - 0.0638541728 * b;
    float s_ = lightness - 0.0894841775 * a - 1.2914855480 * b;

    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;

    return vec3(
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
  }

  vec3 linearSrgbToLinearP3(vec3 linearSrgb) {
    return vec3(
      0.8224621724 * linearSrgb.r + 0.1775378276 * linearSrgb.g,
      0.0331941980 * linearSrgb.r + 0.9668058020 * linearSrgb.g,
      0.0170826307 * linearSrgb.r + 0.0723974407 * linearSrgb.g + 0.9105199286 * linearSrgb.b
    );
  }

  bool inSrgbGamut(vec3 linearSrgb) {
    return (
      linearSrgb.r >= -EPSILON && linearSrgb.r <= 1.0 + EPSILON &&
      linearSrgb.g >= -EPSILON && linearSrgb.g <= 1.0 + EPSILON &&
      linearSrgb.b >= -EPSILON && linearSrgb.b <= 1.0 + EPSILON
    );
  }

  bool inP3Gamut(vec3 linearSrgb) {
    vec3 linearP3 = linearSrgbToLinearP3(linearSrgb);
    return (
      linearP3.r >= -EPSILON && linearP3.r <= 1.0 + EPSILON &&
      linearP3.g >= -EPSILON && linearP3.g <= 1.0 + EPSILON &&
      linearP3.b >= -EPSILON && linearP3.b <= 1.0 + EPSILON
    );
  }

  vec3 mapToGamut(float lightness, float chroma, float hueDeg) {
    vec3 rawLinear = oklchToLinearSrgb(lightness, chroma, hueDeg);
    bool targetContains = u_gamut < 0.5 ? inSrgbGamut(rawLinear) : inP3Gamut(rawLinear);
    if (targetContains) {
      return rawLinear;
    }

    float lo = 0.0;
    float hi = max(chroma, 0.0);
    float mapped = 0.0;
    for (int i = 0; i < GAMUT_ITERS; i += 1) {
      float mid = (lo + hi) * 0.5;
      vec3 testLinear = oklchToLinearSrgb(lightness, mid, hueDeg);
      bool inside = u_gamut < 0.5 ? inSrgbGamut(testLinear) : inP3Gamut(testLinear);
      if (inside) {
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

  void applyOutOfGamutOverlays(
    inout vec3 color,
    inout float alpha,
    bool outP3,
    bool outSrgb
  ) {
    float seedAlpha = clamp(u_seed.w, 0.0, 1.0);

    if (outP3 && u_out_p3_fill.a > 0.0) {
      float fillAlpha = clamp(u_out_p3_fill.a, 0.0, 1.0);
      color = mix(color, u_out_p3_fill.rgb, fillAlpha);
      alpha = max(alpha, fillAlpha * seedAlpha);
    }

    if (outSrgb && u_out_srgb_fill.a > 0.0) {
      float fillAlpha = clamp(u_out_srgb_fill.a, 0.0, 1.0);
      color = mix(color, u_out_srgb_fill.rgb, fillAlpha);
      alpha = max(alpha, fillAlpha * seedAlpha);
    }

    bool anyOut = outP3 || outSrgb;
    if (anyOut && u_dot_pattern.x > 0.0 && u_dot_pattern.y > 0.0) {
      float opacity = clamp(u_dot_pattern.x, 0.0, 1.0);
      float dotSize = max(1.0, u_dot_pattern.y);
      float dotGap = max(0.0, u_dot_pattern.z);
      float cell = dotSize + dotGap;
      float localX = mod(gl_FragCoord.x - 0.5, cell);
      float localY = mod(gl_FragCoord.y - 0.5, cell);
      float inDotX = 1.0 - step(dotSize, localX);
      float inDotY = 1.0 - step(dotSize, localY);
      float dotMask = inDotX * inDotY;
      float dotOpacity = dotMask * opacity;
      color = mix(color, vec3(1.0), dotOpacity);
      alpha = max(alpha, dotOpacity * seedAlpha);
    }
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
    if (u_source >= 0.5 && u_repeat_edge_pixels >= 0.5) {
      renderLinear = mapToGamut(l, c, h);
    }

    vec3 baseColor = vec3(
      transferLinearToSrgb(renderLinear.r),
      transferLinearToSrgb(renderLinear.g),
      transferLinearToSrgb(renderLinear.b)
    );
    float alpha = clamp(u_seed.w, 0.0, 1.0);

    bool targetOut = u_gamut < 0.5 ? (outP3 || outSrgb) : outP3;
    bool clipOutOfGamut = u_source >= 0.5 && u_repeat_edge_pixels < 0.5 && targetOut;
    if (clipOutOfGamut) {
      baseColor = vec3(0.0);
      alpha = 0.0;
    }

    applyOutOfGamutOverlays(baseColor, alpha, outP3, outSrgb);

    gl_FragColor = vec4(baseColor, alpha);
  }
`;
