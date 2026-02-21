#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 outColor;

uniform vec2  u_resolution;   // pixels
uniform int   u_iters;        // slider
uniform int   u_colorMode;    // dropdown
uniform vec2  u_pan;          // world pan
uniform float u_zoom;         // world zoom (scale)
uniform float u_time;         // optional animation

// --- Define your triangle in "world coords"
const vec2 A = vec2(0.0, 0.0);
const vec2 B = vec2(1.0, 0.0);
const vec2 C = vec2(0.0, 1.0);

// Barycentric helpers
float cross2(vec2 u, vec2 v) { return u.x * v.y - u.y * v.x; }

bool pointInTri(vec2 p, vec2 a, vec2 b, vec2 c) {
  // Same-side technique; robust enough for visualization
  float c1 = cross2(b - a, p - a);
  float c2 = cross2(c - b, p - b);
  float c3 = cross2(a - c, p - c);
  bool hasNeg = (c1 < 0.0) || (c2 < 0.0) || (c3 < 0.0);
  bool hasPos = (c1 > 0.0) || (c2 > 0.0) || (c3 > 0.0);
  return !(hasNeg && hasPos);
}

// Signed distance to each edge (non-negative inside if oriented consistently)
// Here we just use absolute distance-to-line for a simple statistic.
float distToLine(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return abs(cross2(ab, p - a)) / max(length(ab), 1e-12);
}

// Example: pick the "piece" by splitting triangle into two sub-triangles.
// For a right triangle (A,B,C), a natural split is along the median from A to midpoint of BC.
// Replace this logic with your true partition.
bool inPiece0(vec2 p) {
  vec2 mid = 0.5 * (B + C);
  // Which side of line A->mid?
  float s = cross2(mid - A, p - A);
  // Choose sign convention that gives a half-triangle
  return s >= 0.0;
}

// --- Your two affine pieces (PLACEHOLDERS)
// Replace these with your actual shear and area-doubling affine maps on the triangle.
// Keep them affine: p' = M*p + t.
vec2 piece0(vec2 p) {
  // shear placeholder
  mat2 M = mat2(1.0, 0.6,
                0.0, 1.0);
  return M * p;
}

vec2 piece1(vec2 p) {
  // area-doubling-ish placeholder (not guaranteed to map triangle to itself)
  mat2 M = mat2(2.0, 0.0,
                0.0, 1.0);
  return M * p;
}

// Optional: fold back / project into triangle if your real dynamics requires it.
// For many piecewise-linear maps on a fundamental domain, you apply an affine map then
// mod / reflect / re-triangulate. Implement your true rule here.
vec2 normalizeToDomain(vec2 p) {
  return p;
}

vec3 paletteEdge(float d) {
  // Simple smooth ramp: dark near edge, brighter away
  float t = 1.0 - exp(-6.0 * d);
  return vec3(t);
}

void main() {
  // Screen -> centered coords -> world coords
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 xy = (v_uv * 2.0 - 1.0) * aspect;     // roughly [-aspect, +aspect]
  vec2 p0 = (xy / u_zoom) + u_pan;           // world point

  // Only draw inside triangle; outside = transparent
  if (!pointInTri(p0, A, B, C)) {
    outColor = vec4(0.0);
    return;
  }

  vec2 p = p0;

  // Orbit stats
  int symHash = 0;
  float minEdgeDist = 1e9;

  for (int i = 0; i < 2000; i++) { // hard cap; actual steps controlled by u_iters
    if (i >= u_iters) break;

    bool s0 = inPiece0(p);
    symHash = (symHash * 1315423911) ^ (s0 ? 0x9e3779b9 : 0x7f4a7c15);

    p = s0 ? piece0(p) : piece1(p);
    p = normalizeToDomain(p);

    // Track how close we get to edges
    float dAB = distToLine(p, A, B);
    float dBC = distToLine(p, B, C);
    float dCA = distToLine(p, C, A);
    minEdgeDist = min(minEdgeDist, min(dAB, min(dBC, dCA)));
  }

  // A few example “boring-mixing-resistant” colorings:
  vec3 col = vec3(0.0);

  if (u_colorMode == 0) {
    // distance-to-edge statistic (min over orbit)
    col = paletteEdge(minEdgeDist);

  } else if (u_colorMode == 1) {
    // which edge is closest at the final iterate
    float dAB = distToLine(p, A, B);
    float dBC = distToLine(p, B, C);
    float dCA = distToLine(p, C, A);
    if (dAB <= dBC && dAB <= dCA) col = vec3(1.0, 0.2, 0.2);
    else if (dBC <= dAB && dBC <= dCA) col = vec3(0.2, 1.0, 0.2);
    else col = vec3(0.2, 0.2, 1.0);

  } else {
    // symbolic hash → pseudo-color (works well for small N)
    // convert int hash-ish to floats
    uint h = uint(symHash);
    float r = float((h      ) & 255u) / 255.0;
    float g = float((h >> 8 ) & 255u) / 255.0;
    float b = float((h >> 16) & 255u) / 255.0;
    col = vec3(r, g, b);
  }

  outColor = vec4(col, 1.0);
}