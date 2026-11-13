const MAX_CLASSIFICATION_STEPS = 1_000_000;

function stateKey(x, y) {
  return `${x},${y}`;
}

function gcdNumber(first, second) {
  let a = Math.abs(first);
  let b = Math.abs(second);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function commonDivisor(x, y, q) {
  return gcdNumber(gcdNumber(x, y), q);
}

function fractionText(numerator, denominator) {
  const divisor = gcdNumber(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}

export function formatRationalPoint(x, y, q) {
  return `(${fractionText(x, q)}, ${fractionText(y, q)})`;
}

export function primeFactorization(value) {
  if (!Number.isInteger(value) || value < 2 || value > 0x7fffffff) {
    throw new RangeError("Factorization requires an integer from 2 through 2^31 - 1");
  }
  const factors = [];
  let remainder = value;
  for (let prime = 2; prime * prime <= remainder; prime += prime === 2 ? 1 : 2) {
    if (remainder % prime !== 0) continue;
    let exponent = 0;
    while (remainder % prime === 0) {
      remainder /= prime;
      exponent += 1;
    }
    factors.push([prime, exponent]);
  }
  if (remainder > 1) factors.push([remainder, 1]);
  return factors;
}

export function factorizationHtml(value) {
  return primeFactorization(value)
    .map(([prime, exponent]) => exponent === 1 ? String(prime) : `${prime}<sup>${exponent}</sup>`)
    .join(" × ");
}

export function integerConfigurationMove(x, y) {
  if (x === y) return null;
  return y > x ? "S" : "R";
}

export function integerConfigurationStep(x, y, q) {
  return y > x ? [x, y - x] : [q - x - y, x - y];
}

export function isInteriorGridPoint(x, y, q) {
  return Number.isInteger(x) && Number.isInteger(y) &&
    x > 0 && y > 0 && x + y < q;
}

export function gridPointAt(point, q) {
  if (point[0] < 0 || point[1] < 0 || point[0] + point[1] > 1) return null;
  const x = Math.floor(point[0] * q + 0.5);
  const y = Math.floor(point[1] * q + 0.5);
  return isInteriorGridPoint(x, y, q) ? { x, y } : null;
}

function cachedSuccessorInfo(info, item, q) {
  if (info.kind === "unresolved") return info;
  if (info.kind === "singular") {
    return { kind: "singular", singularSteps: info.singularSteps + 1 };
  }
  return {
    kind: "preperiodic",
    preperiod: info.preperiod + 1,
    period: info.period,
    distinctShears: info.distinctShears,
    eventualGcd: Math.max(commonDivisor(item.x, item.y, q), info.eventualGcd),
  };
}

export class RationalOrbitClassifier {
  constructor(q) {
    if (!Number.isInteger(q) || q < 3 || q > 0x7fffffff) {
      throw new RangeError("The denominator must be an integer from 3 through 2^31 - 1");
    }
    this.q = q;
    this.cache = new Map();
  }

  classify(x, y) {
    if (!isInteriorGridPoint(x, y, this.q)) {
      throw new RangeError(`(${x}/${this.q}, ${y}/${this.q}) is not in the open simplex`);
    }
    const initialKey = stateKey(x, y);
    const known = this.cache.get(initialKey);
    if (known) return known;

    const path = [];
    const pathIndex = new Map();
    let currentX = x;
    let currentY = y;

    for (let steps = 0; steps <= MAX_CLASSIFICATION_STEPS; steps++) {
      const key = stateKey(currentX, currentY);
      const cached = this.cache.get(key);
      if (cached) {
        let next = cached;
        for (let index = path.length - 1; index >= 0; index--) {
          next = cachedSuccessorInfo(next, path[index], this.q);
          this.cache.set(path[index].key, next);
        }
        return this.cache.get(initialKey);
      }

      if (currentX === currentY) {
        let next = { kind: "singular", singularSteps: 0 };
        this.cache.set(key, next);
        for (let index = path.length - 1; index >= 0; index--) {
          next = { kind: "singular", singularSteps: next.singularSteps + 1 };
          this.cache.set(path[index].key, next);
        }
        return this.cache.get(initialKey);
      }

      const repeatedAt = pathIndex.get(key);
      if (repeatedAt !== undefined) {
        const cycle = path.slice(repeatedAt);
        const shearValues = new Set(
          cycle.filter(item => item.move === "S").map(item => item.x),
        );
        const eventualGcd = cycle.reduce(
          (value, item) => Math.max(value, commonDivisor(item.x, item.y, this.q)),
          1,
        );
        const periodicInfo = {
          kind: "periodic",
          preperiod: 0,
          period: cycle.length,
          distinctShears: shearValues.size,
          eventualGcd,
        };
        for (const item of cycle) this.cache.set(item.key, periodicInfo);

        let next = periodicInfo;
        for (let index = repeatedAt - 1; index >= 0; index--) {
          next = {
            kind: "preperiodic",
            preperiod: next.preperiod + 1,
            period: cycle.length,
            distinctShears: shearValues.size,
            eventualGcd: Math.max(
              commonDivisor(path[index].x, path[index].y, this.q),
              next.eventualGcd,
            ),
          };
          this.cache.set(path[index].key, next);
        }
        return this.cache.get(initialKey);
      }

      pathIndex.set(key, path.length);
      const move = integerConfigurationMove(currentX, currentY);
      path.push({ key, x: currentX, y: currentY, move });
      [currentX, currentY] = integerConfigurationStep(currentX, currentY, this.q);
    }

    const unresolved = { kind: "unresolved", steps: MAX_CLASSIFICATION_STEPS };
    for (const item of path) this.cache.set(item.key, unresolved);
    return unresolved;
  }

  trace(x, y) {
    const classification = this.classify(x, y);
    if (classification.kind === "unresolved") {
      return {
        classification,
        points: [[x, y]],
        moves: [],
        cycleStart: null,
        truncated: true,
      };
    }
    const points = [];
    const moves = [];
    const seen = new Map();
    let currentX = x;
    let currentY = y;

    for (let steps = 0; steps <= MAX_CLASSIFICATION_STEPS; steps++) {
      const key = stateKey(currentX, currentY);
      if (currentX === currentY) {
        points.push([currentX, currentY]);
        return { classification, points, moves, cycleStart: null };
      }
      const repeatedAt = seen.get(key);
      if (repeatedAt !== undefined) {
        points.push([currentX, currentY]);
        return { classification, points, moves, cycleStart: repeatedAt };
      }
      seen.set(key, points.length);
      points.push([currentX, currentY]);
      moves.push(integerConfigurationMove(currentX, currentY));
      [currentX, currentY] = integerConfigurationStep(currentX, currentY, this.q);
    }
    return { classification, points, moves, cycleStart: null, truncated: true };
  }
}

export function symbolicOrbitText(trace) {
  const word = trace.moves.join("");
  if (trace.classification.kind === "singular") return `${word}!`;
  if (trace.cycleStart !== null) {
    const prefix = trace.moves.slice(0, trace.cycleStart).join("");
    const cycle = trace.moves.slice(trace.cycleStart).join("");
    return `${prefix}[${cycle}]`;
  }
  return `${word}${trace.truncated ? "…" : ""}`;
}

function pointText(point) {
  return `(${point[0]}, ${point[1]})`;
}

function shortenedPointList(points, maximum = 240) {
  if (points.length <= maximum) return points.map(pointText);
  const head = points.slice(0, maximum / 2).map(pointText);
  const tail = points.slice(-maximum / 2).map(pointText);
  return [...head, `… ${points.length - maximum} points omitted …`, ...tail];
}

export function rationalOrbitText(trace, q) {
  const rendered = shortenedPointList(trace.points);
  if (trace.classification.kind === "singular") {
    return `(1/${q}) × ${rendered.join(" → ")}!`;
  }
  if (trace.cycleStart !== null && trace.points.length <= 240) {
    const prefix = trace.points.slice(0, trace.cycleStart).map(pointText);
    const cycle = trace.points.slice(trace.cycleStart).map(pointText);
    const prefixText = prefix.length ? `${prefix.join(" → ")} → ` : "";
    return `(1/${q}) × ${prefixText}[${cycle.join(" → ")}]`;
  }
  return `(1/${q}) × ${rendered.join(" → ")}${trace.truncated ? " → …" : ""}`;
}

export function rationalPointDetails(classifier, x, y) {
  const trace = classifier.trace(x, y);
  const info = trace.classification;
  const lines = [
    `point: ${formatRationalPoint(x, y, classifier.q)}`,
    `kind: ${info.kind}`,
    `symbolic orbit: ${symbolicOrbitText(trace)}`,
  ];
  if (info.kind === "singular") {
    lines.push(`steps to singularity: ${info.singularSteps}`);
  } else if (info.kind === "periodic" || info.kind === "preperiodic") {
    lines.push(`preperiod: ${info.preperiod}`);
    lines.push(`period: ${info.period}`);
    lines.push(`distinct shear values on cycle: ${info.distinctShears}`);
    lines.push(`eventual gcd(x, y, q): ${info.eventualGcd}`);
  } else {
    lines.push(`classification stopped after: ${info.steps} steps`);
  }
  lines.push("", "exact orbit:", rationalOrbitText(trace, classifier.q));
  return lines.join("\n");
}

export function orbitColor(info) {
  if (info.kind === "singular") return "#000000";
  if (info.kind === "unresolved") return "#777777";
  const periodScale = Math.min(1, Math.log2(info.period + 1) / 8);
  const shearShift = (info.distinctShears * 17) % 24;
  if (info.kind === "periodic") {
    const hue = info.eventualGcd > 1 ? 42 + shearShift * 0.45 : 112 + shearShift;
    const lightness = 58 - 20 * periodScale;
    const saturation = info.eventualGcd > 1 ? 48 : 72;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }
  const preperiodScale = Math.min(1, Math.log2(info.preperiod + 1) / 8);
  const hue = info.eventualGcd > 1 ? 278 + shearShift * 0.35 : 207 + shearShift * 0.55;
  const lightness = 62 - 17 * periodScale - 10 * preperiodScale;
  const saturation = info.eventualGcd > 1 ? 50 : 78;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}
