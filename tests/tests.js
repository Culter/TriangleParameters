import { Rational } from "../src/rational.js?v=20261112-5";
import { cellFromWord, formatInequality, lineToFloat } from "../src/cells.js?v=20261112-5";
import { configurationMove, firstReturn, itinerary } from "../src/dynamics.js?v=20261112-5";
import {
  factorizationHtml,
  formatRationalPoint,
  gridPointAt,
  integerConfigurationStep,
  RationalOrbitClassifier,
  rationalPointDetails,
  symbolicOrbitText,
} from "../src/rational_points.js?v=20261112-5";

const result = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

try {
  const half = new Rational(2n ** 2000n, 2n ** 2001n);
  assertEqual(half.toString(), "1/2", "rationals normalize exactly");
  assertEqual(half.toNumber(), 0.5, "large rationals convert without overflow");
  assertEqual(new Rational(1n, 3n).add(new Rational(1n, 6n)).toString(), "1/2", "rational addition");
  assertEqual(factorizationHtml(27), "3<sup>3</sup>", "prime-power factorization uses a superscript");
  assertEqual(
    factorizationHtml(175000),
    "2<sup>3</sup> × 5<sup>5</sup> × 7",
    "factorization separates distinct primes with multiplication signs",
  );

  const simplex = cellFromWord("");
  assertEqual(simplex.area.toString(), "1/2", "simplex area");
  assertEqual(simplex.diameterSquared.toString(), "2", "simplex squared diameter");
  assertEqual(simplex.polygon.length, 3, "simplex side count");

  const firstLevel = [cellFromWord("R"), cellFromWord("S")];
  assertEqual(firstLevel[0].area.add(firstLevel[1].area).toString(), "1/2", "first-level cells partition the simplex");

  const secondLevel = ["RR", "RS", "SR", "SS"].map(cellFromWord);
  const secondArea = secondLevel.reduce((sum, cell) => sum.add(cell.area), new Rational(0n));
  assertEqual(secondArea.toString(), "1/2", "second-level cells partition the simplex");
  assertEqual(cellFromWord("SR").area.toString(), "1/12", "SR area agrees with Julia reference data");
  assertEqual(cellFromWord("SSR").area.toString(), "1/24", "SSR area agrees with Julia reference data");
  assertEqual(
    cellFromWord("SR").polygon.map(vertex => `${vertex.x},${vertex.y}`).join(";"),
    "0,0;1/2,1/2;1/3,2/3",
    "SR vertices agree with Julia reference data",
  );

  let forbidden = false;
  try { cellFromWord("SRS"); } catch { forbidden = true; }
  assert(forbidden, "the geometrically forbidden word SRS has no full-dimensional cell");

  assertEqual(configurationMove([0.25, 0.25]), "R", "R wins a branch-boundary tie");
  assertEqual(itinerary([0.4, 0.1], 3).word.length, 3, "itinerary has requested length");

  const simplexLines = simplex.halfplanes.map(lineToFloat);
  const returned = firstReturn([0.2, 0.3], simplexLines, 10);
  assertEqual(returned.steps, 1, "the whole simplex has return time one");
  const rCell = cellFromWord("R");
  const rReturn = firstReturn([0.6, 0.2], rCell.halfplanes.map(lineToFloat), 10);
  assertEqual(rReturn.word, "RS", "first-return word to R");
  assertEqual(cellFromWord(rReturn.word + rCell.word).word, "RSR", "return cell is the global wu cell");
  assertEqual(
    formatInequality({ a: -1n, b: -1n, c: 1n }),
    "-a - b + 1 > 0",
    "inequality formatting",
  );

  const hoverFixture = document.getElementById("hoverFixture");
  const hoverFixtureText = hoverFixture.querySelector("#hover");
  const originalHeight = hoverFixture.getBoundingClientRect().height;
  hoverFixtureText.textContent = "return: " + "RS".repeat(2000) + " cell: " + "SR".repeat(2000);
  assertEqual(
    hoverFixture.getBoundingClientRect().height,
    originalHeight,
    "long hover words do not change the header-row height",
  );
  assertEqual(getComputedStyle(hoverFixtureText).textOverflow, "ellipsis", "long hover words use an ellipsis");
  const modeFixtureText = hoverFixture.querySelector("#mode");
  modeFixtureText.innerHTML = "mode: denominator 27 = 3<sup>3</sup>";
  const primePowerHeight = hoverFixture.getBoundingClientRect().height;
  modeFixtureText.textContent = "mode: denominator 30 = 2 × 3 × 5";
  assertEqual(
    hoverFixture.getBoundingClientRect().height,
    primePowerHeight,
    "factorization superscripts do not change the status-row height",
  );

  assertEqual(integerConfigurationStep(1, 4, 7).join(","), "1,3", "integer S step preserves the common denominator");
  assertEqual(integerConfigurationStep(4, 1, 7).join(","), "2,3", "integer R step preserves the common denominator");
  assertEqual(formatRationalPoint(4, 2, 10), "(2/5, 1/5)", "point labels reduce rational coordinates");
  assertEqual(JSON.stringify(gridPointAt([0.401, 0.199], 5)), JSON.stringify({ x: 2, y: 1 }), "grid hit testing selects the enclosing square");
  assertEqual(gridPointAt([0.8, 0.3], 5), null, "grid hit testing rejects points outside the simplex");

  const seventhClassifier = new RationalOrbitClassifier(7);
  const singularTrace = seventhClassifier.trace(1, 4);
  assertEqual(singularTrace.classification.kind, "singular", "rational orbit singularity is classified exactly");
  assertEqual(singularTrace.classification.singularSteps, 3, "steps to singularity are exact");
  assertEqual(symbolicOrbitText(singularTrace), "SSS!", "singular symbolic orbit formatting");
  const preperiodicTrace = seventhClassifier.trace(3, 1);
  assertEqual(preperiodicTrace.classification.kind, "preperiodic", "strict preperiodicity is classified exactly");
  assertEqual(preperiodicTrace.classification.preperiod, 2, "preperiod length is exact");
  assertEqual(symbolicOrbitText(preperiodicTrace), "RR[RRS]", "preperiodic symbolic orbit formatting");
  assert(
    rationalPointDetails(seventhClassifier, 1, 4).includes("(1/7) × (1, 4) → (1, 3) → (1, 2) → (1, 1)!"),
    "exact orbit details factor out the common denominator",
  );
  const seventhCounts = { singular: 0, periodic: 0, preperiodic: 0 };
  for (let x = 1; x < 7; x++) {
    for (let y = 1; x + y < 7; y++) seventhCounts[seventhClassifier.classify(x, y).kind] += 1;
  }
  assertEqual(seventhCounts.singular, 10, "q=7 singular-point count");
  assertEqual(seventhCounts.periodic, 3, "q=7 periodic-point count");
  assertEqual(seventhCounts.preperiodic, 2, "q=7 strictly pre-periodic-point count");

  const fifthClassifier = new RationalOrbitClassifier(5);
  const fixedTrace = fifthClassifier.trace(2, 1);
  assertEqual(fixedTrace.classification.kind, "periodic", "the rational fixed point is periodic");
  assertEqual(fixedTrace.classification.period, 1, "fixed-point period");
  assertEqual(fixedTrace.classification.eventualGcd, 1, "primitive fixed point stays primitive");
  assertEqual(symbolicOrbitText(fixedTrace), "[R]", "periodic symbolic orbit formatting");

  const tenthClassifier = new RationalOrbitClassifier(10);
  assertEqual(
    tenthClassifier.classify(4, 2).eventualGcd,
    2,
    "the eventual gcd of a visibly unreduced periodic point is exact",
  );
  const fourteenthClassifier = new RationalOrbitClassifier(14);
  const eventuallyReducible = fourteenthClassifier.classify(5, 3);
  assertEqual(eventuallyReducible.kind, "preperiodic", "eventual-reduction test point is pre-periodic");
  assertEqual(
    eventuallyReducible.eventualGcd,
    2,
    "the eventual gcd detects a common divisor gained by a later iterate",
  );
  assertEqual(
    new RationalOrbitClassifier(20).classify(8, 4).eventualGcd,
    4,
    "eventual gcd reports values greater than two",
  );
  assert(
    rationalPointDetails(new RationalOrbitClassifier(20), 8, 4)
      .includes("eventual gcd(x, y, q): 4"),
    "point details print the exact eventual gcd",
  );

  result.dataset.status = "passed";
  result.textContent = `${assertions} assertions passed`;
} catch (error) {
  result.dataset.status = "failed";
  result.textContent = error.stack || String(error);
  throw error;
}
