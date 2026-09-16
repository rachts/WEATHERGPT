// WeatherGPT — Marathi Language Detection Unit Tests (H1)
// Verifies that Devanagari Marathi messages correctly resolve to "mr" and Hindi to "hi".

import assert from "node:assert";
import { detectMessageLanguage } from "../lib/ai/pipeline";

export function runMarathiDetectionTests() {
  console.log("\n========================================================");
  console.log("   MARATHI LANGUAGE DETECTION TESTS (H1)               ");
  console.log("========================================================\n");

  const marathiTestPhrases = [
    "आज पाऊस पडेल का?",
    "हवामान कसे आहे?",
    "पिकावर फवारणी कशी करावी सांगा",
    "पाऊस पडू शकतो का",
    "उद्या पाऊस होईल काय",
  ];

  for (const phrase of marathiTestPhrases) {
    const result = detectMessageLanguage(phrase);
    assert.strictEqual(
      result.code,
      "mr",
      `Expected phrase "${phrase}" to resolve to 'mr' (Marathi), but got '${result.code}'`
    );
  }
  console.log("  ✔ Verified 5 Marathi phrases successfully resolve to 'mr' (Marathi).");

  const hindiTestPhrases = [
    "आज बारिश होगी क्या?",
    "मौसम कैसा रहेगा?",
    "फसल की सिंचाई कब करें?",
  ];

  for (const phrase of hindiTestPhrases) {
    const result = detectMessageLanguage(phrase);
    assert.strictEqual(
      result.code,
      "hi",
      `Expected phrase "${phrase}" to resolve to 'hi' (Hindi), but got '${result.code}'`
    );
  }
  console.log("  ✔ Verified 3 Hindi phrases successfully resolve to 'hi' (Hindi).");

  console.log("\n========================================================");
  console.log("   ALL MARATHI DETECTION TESTS PASSED!                 ");
  console.log("========================================================\n");
}

if (process.argv[1]?.includes("marathi-detection.test.ts")) {
  runMarathiDetectionTests();
}
