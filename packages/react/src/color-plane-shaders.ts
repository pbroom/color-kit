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
  uniform sampler2D u_tex;

  void main() {
    gl_FragColor = texture2D(u_tex, vec2(v_uv.x, 1.0 - v_uv.y));
  }
`;
