// WeatherGPT — Gate G19: Intent Matching & Substring Collision Guard Test (H2)
import assert from "node:assert";
import { resolveIntent, extractCropFromQuery, compileTokenRegex } from "../lib/services/query-pipeline";
import { getDeterministicCropAdvisory } from "../lib/services/advisory-rules";

export async function runIntentMatchingTests() {
  console.log("\n========================================================");
  console.log("   INTENT MATCHING & SUBSTRING COLLISION TESTS (H2)     ");
  console.log("========================================================\n");

  let passed = 0;

  // 1. Substring collisions with "rain" (grain, drain, drainage, train, brain, strain)
  const nonRainQueries = [
    { query: "How to optimize grain storage after harvest", expectedNot: "rainfall_forecast" },
    { query: "Field drainage and soil ditch management", expectedNot: "rainfall_forecast" },
    { query: "Train travel delays due to fog", expectedNot: "rainfall_forecast" },
    { query: "Brain fog among farm workers during summer", expectedNot: "rainfall_forecast" },
    { query: "Back strain relief after harvesting", expectedNot: "rainfall_forecast" },
  ];

  for (const { query, expectedNot } of nonRainQueries) {
    const intent = resolveIntent(query);
    assert.notStrictEqual(
      intent,
      expectedNot,
      `Query "${query}" should not resolve to ${expectedNot} due to substring collision, resolved: ${intent}`
    );
  }
  console.log("  ✔ Substring collision guard verified: grain, drain, train, brain do NOT resolve to rainfall_forecast.");
  passed++;

  // 2. Substring collision with "cane" inside "hurricane"
  const hurricaneQuery = "Hurricane alert and storm warning for coastal districts";
  const hurricaneIntent = resolveIntent(hurricaneQuery);
  assert.strictEqual(
    hurricaneIntent,
    "warning_status",
    `Hurricane alert should resolve to warning_status, got: ${hurricaneIntent}`
  );
  const extractedFromHurricane = extractCropFromQuery(hurricaneQuery, "paddy");
  assert.strictEqual(
    extractedFromHurricane,
    "paddy",
    `Hurricane should NOT extract "sugarcane" as crop (cane substring), got: ${extractedFromHurricane}`
  );
  console.log("  ✔ Substring collision guard verified: hurricane does NOT match 'cane' or extract sugarcane.");
  passed++;

  // 3. Substring collisions with crop names (price/rice, team/tea, steam/tea, impulse/pulse)
  assert.strictEqual(
    extractCropFromQuery("What is the current market price of wheat?", "paddy"),
    "wheat",
    "Should extract wheat and not be confused by 'price' matching 'rice'"
  );
  assert.strictEqual(
    extractCropFromQuery("What is the market price of fertilizer?", "default_crop"),
    "default_crop",
    "'price' must NOT match 'rice'"
  );
  assert.strictEqual(
    extractCropFromQuery("Team meeting on farm", "default_crop"),
    "default_crop",
    "'team' must NOT match 'tea'"
  );
  assert.strictEqual(
    extractCropFromQuery("Steam sterilization for greenhouse soil", "default_crop"),
    "default_crop",
    "'steam' must NOT match 'tea'"
  );
  assert.strictEqual(
    extractCropFromQuery("Impulse irrigation valve", "default_crop"),
    "default_crop",
    "'impulse' must NOT match 'pulse'"
  );
  console.log("  ✔ Substring collision guard verified for crops: price!=rice, team!=tea, steam!=tea, impulse!=pulse.");
  passed++;

  // 4. Substring collision with "now" (know, snow, unknown) and "wind" (window, unwind)
  assert.strictEqual(
    compileTokenRegex("now").test("I need to know the harvest plan"),
    false,
    "'know' must not match 'now'"
  );
  assert.strictEqual(
    compileTokenRegex("now").test("Heavy snow in northern mountains"),
    false,
    "'snow' must not match 'now'"
  );
  assert.strictEqual(
    compileTokenRegex("wind").test("Glass window replacement cost"),
    false,
    "'window' must not match 'wind'"
  );
  assert.strictEqual(
    compileTokenRegex("rain").test("Grain storage facility"),
    false,
    "'grain' must not match 'rain'"
  );
  assert.strictEqual(
    compileTokenRegex("cane").test("Hurricane preparedness guide"),
    false,
    "'cane' must not match inside 'hurricane'"
  );

  assert.strictEqual(
    resolveIntent("I need to know about the wheat crop"),
    "crop_advisory",
    "Should resolve to crop_advisory, not current_weather via 'know'->'now'"
  );
  assert.strictEqual(
    resolveIntent("Inspect the window of the farm shed"),
    "crop_advisory",
    "Should resolve to crop_advisory, not current_weather via 'window'->'wind'"
  );
  console.log("  ✔ Substring collision guard verified: know/snow!=now, window!=wind.");
  passed++;

  // 5. Positive intent recognition
  assert.strictEqual(resolveIntent("Will it rain in Pune today?"), "rainfall_forecast");
  assert.strictEqual(resolveIntent("Heavy rainfall and downpour forecast"), "rainfall_forecast");
  assert.strictEqual(resolveIntent("Cyclone danger warning"), "warning_status");
  assert.strictEqual(resolveIntent("7 day outlook for next week"), "seven_day_outlook");
  assert.strictEqual(resolveIntent("Pesticide spray timing for sugarcane crop"), "crop_advisory");
  assert.strictEqual(resolveIntent("Current temperature and wind speed now"), "current_weather");

  console.log("  ✔ Legitimate queries resolve to their accurate respective intents.");
  passed++;

  // 6. Advisory rules crop parsing does not trigger sugarcane on hurricane
  const advisoryResult = getDeterministicCropAdvisory(
    "hurricane alert",
    "Raigad",
    {
      temperature: 28,
      humidity: 60,
      windSpeed: 10,
      rainfallLast24h: 0,
      rainfallForecastNext24h: 0,
    },
    "en-IN"
  );
  // If sugarcane were matched, actionSummary would contain sugarcaneMulch
  assert.ok(
    !advisoryResult.actionSummary.includes("trash mulching"),
    "Hurricane should not trigger sugarcane trash mulching advisory in advisory rules"
  );
  console.log("  ✔ Advisory rules crop parsing strictly guards against 'cane' in 'hurricane'.");
  passed++;

  console.log("\n========================================================");
  console.log("   ALL INTENT MATCHING & SUBSTRING TESTS PASSED!        ");
  console.log("========================================================\n");
}

if (process.argv[1]?.includes("intent-matching")) {
  runIntentMatchingTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
