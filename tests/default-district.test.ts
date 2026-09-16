import { describe, it } from "node:test";
import assert from "node:assert";
import { DEFAULT_DISTRICT, DEFAULT_STATE } from "../lib/config/constants";
import { getWeather } from "../lib/ai/tools";
import { mapToIMDDistrict } from "../lib/ai/pipeline";
import { getActiveLocation } from "../lib/utils/location";
import { getDistrictWeather } from "../lib/services/weather-data";
import {
  getDeterministicCropAdvisory,
  SPRAY_MAX_WIND_KMH,
  SPRAY_MAX_RAIN_MM,
  SPRAY_MAX_HUMIDITY_PCT,
} from "../lib/services/advisory-rules";

export async function runDefaultDistrictTests() {
  console.log("Gate G22: Centralized Default District & Advisory Rules Constants (H5, M5, M6, M10, M11, M12)...");

  // 1. Centralized constants
  assert.strictEqual(DEFAULT_DISTRICT, "Raigad", "DEFAULT_DISTRICT must be Raigad");
  assert.strictEqual(DEFAULT_STATE, "Maharashtra", "DEFAULT_STATE must be Maharashtra");

  // 2. getWeather tool default without arguments
  const defaultWeather = await getWeather.execute!(
    {},
    { toolCallId: "test-call-1", messages: [], context: {} }
  );
  assert.strictEqual((defaultWeather as any).success, true, "getWeather.execute({}) should succeed");
  assert.strictEqual((defaultWeather as any).district, "Raigad", "Default weather should resolve to Raigad");

  // 3. getWeather tool with state parameter (M12)
  const puneWeather = await getWeather.execute!(
    { district: "Pune", state: "Maharashtra" },
    { toolCallId: "test-call-2", messages: [], context: {} }
  );
  assert.strictEqual((puneWeather as any).success, true);
  assert.strictEqual((puneWeather as any).district, "Pune");

  // 4. mapToIMDDistrict fallback
  const mapped = mapToIMDDistrict(null);
  assert.strictEqual(mapped.district, DEFAULT_DISTRICT, "mapToIMDDistrict(null) should fallback to Raigad");

  // 5. getActiveLocation default
  const activeLoc = getActiveLocation();
  assert.strictEqual(activeLoc.district, DEFAULT_DISTRICT);
  assert.strictEqual(activeLoc.state, DEFAULT_STATE);

  // 6. getDistrictWeather options object signature (M5)
  const optionsWeather = await getDistrictWeather("Pune", {
    state: "Maharashtra",
    simulateImdFailure: true, // Forces fallback cleanly without network
  });
  assert.strictEqual(optionsWeather.district, "Pune");
  assert.strictEqual(optionsWeather.state, "Maharashtra");

  // 7. Advisory rules constants & ICAR-CRIDA provider attribution (M10, M11)
  assert.strictEqual(SPRAY_MAX_WIND_KMH, 15);
  assert.strictEqual(SPRAY_MAX_RAIN_MM, 5);
  assert.strictEqual(SPRAY_MAX_HUMIDITY_PCT, 90);

  const advisory = getDeterministicCropAdvisory(
    "tomato",
    DEFAULT_DISTRICT,
    {
      temperature: 28,
      humidity: 70,
      windSpeed: 10,
      rainfallLast24h: 0,
      rainfallForecastNext24h: 0,
    },
    "en-IN"
  );

  assert.ok(advisory.evidence, "Advisory evidence must be defined");
  assert.strictEqual(advisory.evidence.provider, "OTHER", "Provider must be OTHER for ICAR-CRIDA");
  assert.strictEqual(advisory.evidence.providerName, "ICAR-CRIDA", "Provider name must be ICAR-CRIDA");
  assert.ok(
    advisory.pestDiseaseAdvisory.includes(`${SPRAY_MAX_WIND_KMH} km/h`),
    "Advisory text must use single-source-of-truth wind threshold constant"
  );

  console.log("✅ Gate G22 Passed: Default district, options overload, and advisory thresholds verified.");
}

if (process.argv[1]?.endsWith("default-district.test.ts")) {
  runDefaultDistrictTests().catch((err) => {
    console.error("G22 Failed:", err);
    process.exit(1);
  });
}
