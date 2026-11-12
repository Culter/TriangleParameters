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
uniform int   u_appMode;      // 0 = cells, 1 = exact rational grid
uniform int   u_returnMode;
uniform int   u_returnLimit;
uniform int   u_domainLineCount;
uniform vec3  u_domainLines[128];
uniform int   u_colorWholeWord;
uniform int   u_selectedWordLength;
uniform highp usampler2D u_selectedWord;

const int MAX_RETURN_ITERS = 16384;
const int MAX_SELECTED_WORD = 16384;

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

bool inPiece0(vec2 p) {
  return p.y > p.x;
}

vec2 piece0(vec2 p) {
  return vec2(p.x, p.y - p.x);
}

vec2 piece1(vec2 p) {
  return vec2(1.0 - p.x - p.y, p.x - p.y);
}

vec3 paletteEdge(float d) {
  // Simple smooth ramp: dark near edge, brighter away
  float t = 1.0 - exp(-6.0 * d);
  return vec3(t);
}

float softNormalize(float n) {
    return n / (n + 2.0);
}

float softScale(float n, float max) {
    float normalized = softNormalize(n);
    float scale = softNormalize(max + 1.0);
    return normalized / scale;
}

vec3 lerp01(vec3 a, vec3 b, float p) {
    return p * b + (1.0-p) * a;
}

vec3 lerp(vec3 a, vec3 b, float p, float p1, float p2) {
    return lerp01(a, b, (p-p1)/(p2-p1));
}

vec3 getColorVector(float x) {
    x = mod(x, 1.0);
    if (x < 1.0/3.0) {
        return lerp(vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), x, 0.0, 1.0/3.0);
    } else if (x < 2.0/3.0) {
        return lerp(vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0), x, 1.0/3.0, 2.0/3.0);
    } else {
        return lerp(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), x, 2.0/3.0, 1.0);
    }
}

vec3 getColorBasis(int n) {
    return getColorVector(float(n) * 0.618033988749895);
}

bool inSelectedDomain(vec2 p) {
  for (int i = 0; i < 128; i++) {
    if (i >= u_domainLineCount) break;
    vec3 line = u_domainLines[i];
    if (dot(line.xy, p) + line.z < -1e-7) return false;
  }
  return true;
}

void accumulateMove(bool isShear, inout vec3 pigment, inout int shearRun, inout int expansions) {
  if (isShear) {
    shearRun += 1;
  } else {
    pigment += getColorBasis(expansions) * softNormalize(float(shearRun));
    expansions += 1;
    shearRun = 0;
  }
}

vec3 finishWordColor(vec3 pigment, int shearRun, int expansions, int length) {
  pigment += getColorBasis(expansions) * softNormalize(float(shearRun));
  float scale = max(softNormalize(float(length + 1)), 1e-8);
  return vec3(1.0) - pigment / scale;
}

void main() {
  // Screen -> centered coords -> world coords
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 xy = (v_uv * 2.0 - 1.0) * aspect;     // roughly [-aspect, +aspect]
  vec2 p0 = (xy / u_zoom) + u_pan;           // world point

  if (u_appMode == 1) {
    outColor = vec4(0.035, 0.035, 0.04, 1.0);
    return;
  }

  // Only draw inside triangle; outside = transparent
  if (!pointInTri(p0, A, B, C)) {
    outColor = vec4(0.0);
    return;
  }

  if (u_returnMode != 0) {
    if (!inSelectedDomain(p0)) {
      outColor = vec4(0.035, 0.035, 0.04, 1.0);
      return;
    }

    vec2 returnPoint = p0;
    vec3 pigment = vec3(0.0);
    int shearRun = 0;
    int expansions = 0;
    int returnLength = 0;
    bool returned = false;

    for (int i = 0; i < MAX_RETURN_ITERS; i++) {
      if (i >= u_returnLimit) break;
      // S is chosen only for the strict inequality b > a; ties choose R.
      bool isShear = inPiece0(returnPoint);
      accumulateMove(isShear, pigment, shearRun, expansions);
      returnPoint = isShear ? piece0(returnPoint) : piece1(returnPoint);
      returnLength += 1;
      if (inSelectedDomain(returnPoint)) {
        returned = true;
        break;
      }
    }

    if (!returned) {
      outColor = vec4(0.16, 0.16, 0.18, 1.0);
      return;
    }

    int colorLength = returnLength;
    if (u_colorWholeWord != 0) {
      for (int i = 0; i < MAX_SELECTED_WORD; i++) {
        if (i >= u_selectedWordLength) break;
        bool isShear = texelFetch(u_selectedWord, ivec2(i, 0), 0).r != 0u;
        accumulateMove(isShear, pigment, shearRun, expansions);
      }
      colorLength += u_selectedWordLength;
    }

    outColor = vec4(finishWordColor(pigment, shearRun, expansions, colorLength), 1.0);
    return;
  }

  vec2 p = p0;

  // Orbit stats
  int symHash = 0;
  float minEdgeDist = 1e9;

  vec3 pigment = vec3(0.0);
  int numConsecutiveShears = 0;
  int numExpansions = 0;

  for (int i = 0; i < 2000; i++) { // hard cap; actual steps controlled by u_iters
    if (i >= u_iters) {
        break;
    }

    bool s0 = inPiece0(p);
    symHash = (symHash * 1315423911) ^ (s0 ? 0x9e3779b9 : 0x7f4a7c15);
    accumulateMove(s0, pigment, numConsecutiveShears, numExpansions);

    p = s0 ? piece0(p) : piece1(p);

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

  } else if (u_colorMode == 2) {
    // symbolic hash → pseudo-color (works well for small N)
    // convert int hash-ish to floats
    uint h = uint(symHash);
    float r = float((h      ) & 255u) / 255.0;
    float g = float((h >> 8 ) & 255u) / 255.0;
    float b = float((h >> 16) & 255u) / 255.0;
    col = vec3(r, g, b);

  } else {
    col = finishWordColor(pigment, numConsecutiveShears, numExpansions, u_iters);
  }

  outColor = vec4(col, 1.0);
}
