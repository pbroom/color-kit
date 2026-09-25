import { packColors, type Color } from 'color-kit';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec3 aColor;
out vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform bool uEncode;
in vec3 vColor;
out vec4 outColor;
vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(0.0031308, c));
}
void main() {
  // Vertex colors arrive linear when uEncode is on: the GPU interpolated
  // light, so encode to sRGB for the (sRGB) canvas only at the end.
  outColor = vec4(uEncode ? encodeSrgb(vColor) : vColor, 1.0);
}`;

// Triangle strip: top-left, top-right, bottom-left, bottom-right.
const POSITIONS = new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]);

export type VertexColorSpace = 'linearSrgb' | 'srgb';

export interface GradientRenderer {
  /** Draw a quad with one color per corner (TL, TR, BL, BR). */
  draw(corners: readonly Color[], space: VertexColorSpace): Float32Array;
  dispose(): void;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
  }
  return shader;
}

export function createGradientRenderer(
  gl: WebGL2RenderingContext,
): GradientRenderer {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, POSITIONS, gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // One reused Float32Array: 4 vertices x [r, g, b].
  const vertexColors = new Float32Array(4 * 3);
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexColors.byteLength, gl.DYNAMIC_DRAW);
  const aColor = gl.getAttribLocation(program, 'aColor');
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

  const uEncode = gl.getUniformLocation(program, 'uEncode');

  return {
    draw(corners, space) {
      packColors(corners, space, vertexColors, { clamp: true });
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexColors);
      gl.uniform1i(uEncode, space === 'linearSrgb' ? 1 : 0);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return vertexColors;
    },
    dispose() {
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteProgram(program);
    },
  };
}
