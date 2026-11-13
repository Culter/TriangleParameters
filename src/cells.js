// Keep this version synchronized with index.html and main.js when deploying coupled asset changes.
import { Rational, rational, ZERO, ONE } from "./rational.js?v=20261112-3";

const IDENTITY = [
  [1n, 0n, 0n],
  [0n, 1n, 0n],
  [0n, 0n, 1n],
];

const S_MATRIX = [
  [1n, 0n, 0n],
  [-1n, 1n, 0n],
  [0n, 0n, 1n],
];

const R_MATRIX = [
  [-1n, -1n, 1n],
  [1n, -1n, 0n],
  [0n, 0n, 1n],
];

function point(x, y) {
  return { x: rational(x), y: rational(y) };
}

const SIMPLEX = [point(0n, 0n), point(1n, 0n), point(0n, 1n)];

function absBigInt(value) {
  return value < 0n ? -value : value;
}

function gcd(first, second) {
  let a = absBigInt(first);
  let b = absBigInt(second);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function gcd3(a, b, c) {
  return gcd(gcd(a, b), c);
}

function lcm(first, second) {
  if (first === 0n || second === 0n) return 0n;
  return absBigInt((first / gcd(first, second)) * second);
}

function matrixMultiply(first, second) {
  return Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, column) => {
      let value = 0n;
      for (let k = 0; k < 3; k++) value += first[row][k] * second[k][column];
      return value;
    })
  );
}

function lineValue(line, p) {
  return p.x.mul(line.a).add(p.y.mul(line.b)).add(line.c);
}

function samePoint(first, second) {
  return first.x.equals(second.x) && first.y.equals(second.y);
}

function deduplicatePolygon(polygon) {
  const result = [];
  for (const vertex of polygon) {
    if (result.length === 0 || !samePoint(vertex, result[result.length - 1])) result.push(vertex);
  }
  if (result.length > 1 && samePoint(result[0], result[result.length - 1])) result.pop();
  return result;
}

function clipPolygon(polygon, line) {
  if (polygon.length === 0) return [];
  const output = [];
  let previous = polygon[polygon.length - 1];
  let previousValue = lineValue(line, previous);
  let previousInside = previousValue.compare(ZERO) >= 0;

  for (const current of polygon) {
    const currentValue = lineValue(line, current);
    const currentInside = currentValue.compare(ZERO) >= 0;
    if (currentInside !== previousInside) {
      const parameter = previousValue.div(previousValue.sub(currentValue));
      output.push(point(
        previous.x.add(current.x.sub(previous.x).mul(parameter)),
        previous.y.add(current.y.sub(previous.y).mul(parameter)),
      ));
    }
    if (currentInside) output.push(current);
    previous = current;
    previousValue = currentValue;
    previousInside = currentInside;
  }
  return deduplicatePolygon(output);
}

function cross(first, second, third) {
  return second.x.sub(first.x).mul(third.y.sub(second.y))
    .sub(second.y.sub(first.y).mul(third.x.sub(second.x)));
}

function removeCollinearVertices(polygon) {
  let result = polygon.slice();
  let changed = true;
  while (changed && result.length >= 3) {
    changed = false;
    const kept = [];
    for (let index = 0; index < result.length; index++) {
      const previous = result[(index - 1 + result.length) % result.length];
      const current = result[index];
      const following = result[(index + 1) % result.length];
      if (cross(previous, current, following).isZero()) changed = true;
      else kept.push(current);
    }
    result = kept;
  }
  return result;
}

function normalizedLine(a, b, c) {
  const divisor = gcd3(a, b, c);
  if (divisor === 0n) throw new Error("A line must have a nonzero coefficient");
  return { a: a / divisor, b: b / divisor, c: c / divisor };
}

function orientedBranchLine(prefix, move) {
  let coefficients = prefix[0].map((value, index) => value - prefix[1][index]);
  if (move === "S") coefficients = coefficients.map(value => -value);
  return normalizedLine(...coefficients);
}

function signedArea(polygon) {
  let twiceArea = ZERO;
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea = twiceArea.add(current.x.mul(next.y).sub(next.x.mul(current.y)));
  }
  return twiceArea.div(2n);
}

function squaredDistance(first, second) {
  const dx = first.x.sub(second.x);
  const dy = first.y.sub(second.y);
  return dx.mul(dx).add(dy.mul(dy));
}

function diameterSquared(polygon) {
  let result = ZERO;
  for (let first = 0; first < polygon.length; first++) {
    for (let second = first + 1; second < polygon.length; second++) {
      const distance = squaredDistance(polygon[first], polygon[second]);
      if (distance.compare(result) > 0) result = distance;
    }
  }
  return result;
}

function integerLineThrough(first, second) {
  const a = first.y.sub(second.y);
  const b = second.x.sub(first.x);
  const c = first.x.mul(second.y).sub(second.x.mul(first.y));
  const scale = lcm(lcm(a.d, b.d), c.d);
  return normalizedLine(
    a.n * (scale / a.d),
    b.n * (scale / b.d),
    c.n * (scale / c.d),
  );
}

export function polygonHalfplanes(polygon) {
  const centroid = point(
    polygon.reduce((sum, vertex) => sum.add(vertex.x), ZERO).div(BigInt(polygon.length)),
    polygon.reduce((sum, vertex) => sum.add(vertex.y), ZERO).div(BigInt(polygon.length)),
  );
  return polygon.map((vertex, index) => {
    let line = integerLineThrough(vertex, polygon[(index + 1) % polygon.length]);
    if (lineValue(line, centroid).compare(ZERO) < 0) {
      line = { a: -line.a, b: -line.b, c: -line.c };
    }
    return line;
  });
}

export function lineToFloat(line) {
  const scale = [absBigInt(line.a), absBigInt(line.b), absBigInt(line.c)]
    .reduce((maximum, value) => value > maximum ? value : maximum, 1n);
  return [
    new Rational(line.a, scale).toNumber(),
    new Rational(line.b, scale).toNumber(),
    new Rational(line.c, scale).toNumber(),
  ];
}

export function cellFromWord(word) {
  if (!/^[RS]*$/.test(word)) throw new Error("A cell word may contain only R and S");
  let polygon = SIMPLEX.slice();
  let prefix = IDENTITY.map(row => row.slice());
  const inequalities = [
    { a: 1n, b: 0n, c: 0n, source: "simplex" },
    { a: 0n, b: 1n, c: 0n, source: "simplex" },
    { a: -1n, b: -1n, c: 1n, source: "simplex" },
  ];

  for (let index = 0; index < word.length; index++) {
    const move = word[index];
    const line = orientedBranchLine(prefix, move);
    inequalities.push({ ...line, source: `step ${index + 1} (${move})` });
    polygon = removeCollinearVertices(clipPolygon(polygon, line));
    if (polygon.length < 3 || signedArea(polygon).isZero()) {
      throw new Error(`The word ${word} has no full-dimensional cell`);
    }
    prefix = matrixMultiply(move === "R" ? R_MATRIX : S_MATRIX, prefix);
  }

  const areaSigned = signedArea(polygon);
  const area = areaSigned.compare(ZERO) < 0 ? areaSigned.neg() : areaSigned;
  const diameter2 = diameterSquared(polygon);
  return {
    word,
    polygon,
    inequalities,
    area,
    diameterSquared: diameter2,
    diameter: Math.sqrt(diameter2.toNumber()),
    halfplanes: polygonHalfplanes(polygon),
    prefixMatrix: prefix,
  };
}

function term(coefficient, variable, first) {
  if (coefficient === 0n) return "";
  const negative = coefficient < 0n;
  const magnitude = absBigInt(coefficient);
  const body = `${magnitude === 1n && variable ? "" : magnitude}${variable}`;
  if (first) return negative ? `-${body}` : body;
  return negative ? ` - ${body}` : ` + ${body}`;
}

export function formatInequality(line) {
  let result = "";
  result += term(line.a, "a", result.length === 0);
  result += term(line.b, "b", result.length === 0);
  result += term(line.c, "", result.length === 0);
  return `${result || "0"} > 0`;
}

export function formatPoint(vertex) {
  return `(${vertex.x}, ${vertex.y})`;
}

export function cellDetailsText(cell) {
  const word = cell.word || "ε";
  const vertices = cell.polygon.map((vertex, index) =>
    `  v${index + 1} = ${formatPoint(vertex)}`).join("\n");
  const inequalities = cell.inequalities.map(inequality =>
    `  ${formatInequality(inequality)}  [${inequality.source}]`).join("\n");
  return [
    `word: ${word}`,
    `sides: ${cell.polygon.length}`,
    `area: ${cell.area}`,
    `diameter²: ${cell.diameterSquared}`,
    `diameter: ${cell.diameter.toPrecision(10)}`,
    "",
    "vertices of closure:",
    vertices,
    "",
    "strict inequalities:",
    inequalities,
  ].join("\n");
}
