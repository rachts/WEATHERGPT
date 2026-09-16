// WeatherGPT — IMD Nowcast Resilient Parser Unit Tests
// Tests HTML extraction, regex parsing against varied fixtures, scored matching, and health degradation.

import assert from "node:assert";
import {
  extractNowcastAreas,
  parseNowcastAreaInfo,
  findBestMatchingNowcastArea,
  getImdParserHealth,
  resetImdParserHealthForTesting,
  ImdNowcastArea,
} from "../lib/services/imd-nowcast-parser";

export async function runNowcastParserTests() {
  console.log("\n========================================================");
  console.log("   IMD NOWCAST RESILIENT PARSER TESTS (C6, M3, M4)      ");
  console.log("========================================================\n");

  resetImdParserHealthForTesting();

  // Test 1: Standard IMD Mausam HTML fixture
  console.log("[Test 1] Parsing standard IMD HTML fixture...");
  const standardHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>District Nowcast</title></head>
    <body>
    <script>
      var mapData = {
        "areas": [
          {
            "id": "IN-MH-RG",
            "title": "Raigad",
            "color": "#FFA500",
            "info": "<b>Time of issue</b>: <p>14-09-2026 14:30:00</p><b>Valid upto</b>: 14-09-2026 17:30:00</p><p>Moderate thunderstorm with lightning and gusty winds (30-40 kmph)</p>",
            "balloonText": "Raigad (Maharashtra)"
          },
          {
            "id": "IN-MH-PU",
            "title": "Pune",
            "color": "#FFFF00",
            "info": "<b>Time of issue</b>: <p>14-09-2026 14:00:00</p><b>Valid upto</b>: 14-09-2026 17:00:00</p><p>Light rain likely over ghat areas</p>",
            "balloonText": "Pune (Maharashtra)"
          }
        ]
      };
    </script>
    </body>
    </html>
  `;

  const areas = extractNowcastAreas(standardHtml);
  assert.strictEqual(areas.length, 2, "Expected 2 areas extracted from standard HTML");
  assert.strictEqual(areas[0].title, "Raigad");
  assert.strictEqual(getImdParserHealth().healthy, true, "Parser health should be healthy");
  console.log("  ✔ Standard HTML extraction verified: 2 areas parsed.");

  // Test 2: Inconsistent HTML markup patterns for issue & validity times (C6, M3)
  console.log("\n[Test 2] Testing resilient bulletin parser across inconsistent markup patterns...");
  const altInfo1 = `
    <b>Time of issue:</b> 14-09-2026 15:00:00
    <br>
    <b>Valid upto:</b> 14-09-2026 18:00:00
    <br>
    <p>Heavy rainfall with squally wind expected.</p>
  `;
  const parsed1 = parseNowcastAreaInfo(altInfo1, "#FF0000", "Raigad");
  assert.strictEqual(parsed1.severity, "Severe");
  assert.strictEqual(parsed1.officialSeverity, "Red");
  assert.ok(parsed1.warningText.includes("Heavy rainfall with squally wind"));
  assert.strictEqual(parsed1.validUntilEstimated, false, "validUntilEstimated should be false when valid upto parses");

  // Missing valid upto markup -> should flag validUntilEstimated: true (M3)
  const altInfo2 = `
    <b>Time of issue</b>: <p>14-09-2026 12:00:00</p>
    <p>Isolated light showers over plain areas.</p>
  `;
  const parsed2 = parseNowcastAreaInfo(altInfo2, "#FFFF00", "Pune");
  assert.strictEqual(parsed2.severity, "Moderate");
  assert.strictEqual(parsed2.validUntilEstimated, true, "M3: validUntilEstimated should be true when valid upto is missing");
  console.log("  ✔ Inconsistent markup parsing & validUntilEstimated (M3) flag verified.");

  // Test 3: Scored district resolution avoiding substring collisions (M4)
  console.log("\n[Test 3] Testing scored district resolution with cross-state disambiguation (M4)...");
  const ambiguousAreas: ImdNowcastArea[] = [
    {
      id: "HP-BIL",
      title: "Bilaspur",
      color: "#FFFF00",
      info: "Himachal Pradesh Bilaspur info",
      balloonText: "Bilaspur (Himachal Pradesh)",
    },
    {
      id: "CG-BIL",
      title: "Bilaspur",
      color: "#FF0000",
      info: "Chhattisgarh Bilaspur info",
      balloonText: "Bilaspur (Chhattisgarh)",
    },
    {
      id: "MH-PUNER",
      title: "Pune Rural",
      color: "#FFFF00",
      info: "Pune Rural Subdivision",
      balloonText: "Pune Rural (Maharashtra)",
    },
    {
      id: "MH-PUNE",
      title: "Pune",
      color: "#FFA500",
      info: "Pune City Central",
      balloonText: "Pune (Maharashtra)",
    },
  ];

  // Disambiguation between Bilaspur HP and Bilaspur CG via state parameter
  const matchCG = findBestMatchingNowcastArea(ambiguousAreas, "Bilaspur", "Chhattisgarh");
  assert.ok(matchCG);
  assert.strictEqual(matchCG?.id, "CG-BIL", "Expected Bilaspur (Chhattisgarh) matched via state boost");

  const matchHP = findBestMatchingNowcastArea(ambiguousAreas, "Bilaspur", "Himachal Pradesh");
  assert.ok(matchHP);
  assert.strictEqual(matchHP?.id, "HP-BIL", "Expected Bilaspur (Himachal Pradesh) matched via state boost");

  // Exact match "Pune" beats prefix "Pune Rural"
  const matchPune = findBestMatchingNowcastArea(ambiguousAreas, "Pune", "Maharashtra");
  assert.ok(matchPune);
  assert.strictEqual(matchPune?.id, "MH-PUNE", "Exact match 'Pune' must score higher than 'Pune Rural'");
  console.log("  ✔ Scored district matching with state disambiguation (M4) verified.");

  // Test 4: Health degradation tracking on 3+ consecutive parse failures (C6)
  console.log("\n[Test 4] Verifying health degradation after 3+ consecutive parse failures...");
  resetImdParserHealthForTesting();
  const corruptedHtml = "<html><body>500 Internal Server Error</body></html>";

  extractNowcastAreas(corruptedHtml); // failure 1
  assert.strictEqual(getImdParserHealth().consecutiveFailures, 1);
  assert.strictEqual(getImdParserHealth().healthy, true);

  extractNowcastAreas(corruptedHtml); // failure 2
  assert.strictEqual(getImdParserHealth().consecutiveFailures, 2);
  assert.strictEqual(getImdParserHealth().healthy, true);

  extractNowcastAreas(corruptedHtml); // failure 3 -> triggers degraded health!
  const health = getImdParserHealth();
  assert.strictEqual(health.consecutiveFailures, 3);
  assert.strictEqual(health.healthy, false, "Parser health must transition to degraded after 3 consecutive failures");
  console.log("  ✔ Health degradation correctly flagged (healthy=false, failures=3).");

  console.log("\n========================================================");
  console.log("   ALL IMD NOWCAST RESILIENT PARSER TESTS PASSED!       ");
  console.log("========================================================\n");
}

if (process.argv[1]?.includes("imd-nowcast-parser.test.ts")) {
  runNowcastParserTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
