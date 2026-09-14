import assert from "node:assert";
import { degreesToCardinal } from "../lib/utils/geo";

console.log("Running Wind Direction Cardinal Tests...");

// Unit tests covering: 0°, 22.5°, 45°, 90°, 180°, 270°, 359°
const testCases: Array<{ deg: number | null | undefined; expected: string | null }> = [
  { deg: 0, expected: "N" },
  { deg: 22.5, expected: "NNE" },
  { deg: 45, expected: "NE" },
  { deg: 90, expected: "E" },
  { deg: 180, expected: "S" },
  { deg: 270, expected: "W" },
  { deg: 359, expected: "N" },
  { deg: 360, expected: "N" },
  { deg: 135, expected: "SE" },
  { deg: 225, expected: "SW" },
  { deg: 315, expected: "NW" },
  { deg: null, expected: "Calm" },
  { deg: undefined, expected: "Calm" },
];

for (const tc of testCases) {
  const result = degreesToCardinal(tc.deg);
  assert.strictEqual(
    result,
    tc.expected,
    `Failed for degree ${tc.deg}: expected "${tc.expected}", got "${result}"`
  );
}

console.log("All Wind Direction Cardinal Tests Passed Successfully!");
