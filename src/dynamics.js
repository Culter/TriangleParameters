export function inOpenSimplex(point) {
  return point[0] > 0 && point[1] > 0 && point[0] + point[1] < 1;
}

export function configurationMove(point) {
  // The R branch deliberately wins ties on the singular line a == b.
  return point[1] > point[0] ? "S" : "R";
}

export function configurationStep(point, move = configurationMove(point)) {
  const [a, b] = point;
  return move === "S" ? [a, b - a] : [1 - a - b, a - b];
}

export function itinerary(point, length) {
  if (!inOpenSimplex(point)) return null;
  let current = point.slice();
  let word = "";
  for (let index = 0; index < length; index++) {
    const move = configurationMove(current);
    word += move;
    current = configurationStep(current, move);
  }
  return { word, point: current };
}

export function pointInHalfplanes(point, halfplanes, tolerance = 1e-12) {
  return halfplanes.every(line =>
    line[0] * point[0] + line[1] * point[1] + line[2] >= -tolerance);
}

export function firstReturn(point, domainHalfplanes, limit) {
  if (!pointInHalfplanes(point, domainHalfplanes)) return null;
  let current = point.slice();
  let word = "";
  for (let step = 1; step <= limit; step++) {
    const move = configurationMove(current);
    word += move;
    current = configurationStep(current, move);
    if (pointInHalfplanes(current, domainHalfplanes)) {
      return { word, steps: step, point: current };
    }
  }
  return { word: null, steps: null, point: current };
}
