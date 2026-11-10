import { Rational } from "../src/rational.js";
import { cellFromWord, formatInequality, lineToFloat } from "../src/cells.js";
import { configurationMove, firstReturn, itinerary } from "../src/dynamics.js";

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

  result.dataset.status = "passed";
  result.textContent = `${assertions} assertions passed`;
} catch (error) {
  result.dataset.status = "failed";
  result.textContent = error.stack || String(error);
  throw error;
}
