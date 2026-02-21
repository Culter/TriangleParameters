#version 300 es
precision highp float;

out vec2 v_uv;

void main() {
  // Full-screen triangle in clip space:
  // Vertex IDs: 0,1,2
  vec2 pos = vec2(
    (gl_VertexID == 2) ?  3.0 : -1.0,
    (gl_VertexID == 1) ?  3.0 : -1.0
  );

  // Convert to UV in [0,1]
  v_uv = 0.5 * (pos + 1.0);

  gl_Position = vec4(pos, 0.0, 1.0);
}