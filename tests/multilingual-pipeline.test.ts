import assert from "node:assert";
import { processWeatherQuery, normalizeLanguageCode } from "../lib/services/query-pipeline";
import { extractLocationAndTime } from "../lib/ai/pipeline";

export async function runMultilingualPipelineTests() {
  console.log("Gate G23: Multilingual Coverage & Shared Crisis Engine (H7, M9)...");

  // 1. Language code normalization
  assert.strictEqual(normalizeLanguageCode("mr"), "mr-IN");
  assert.strictEqual(normalizeLanguageCode("bn"), "bn-IN");
  assert.strictEqual(normalizeLanguageCode("hi"), "hi-IN");
  assert.strictEqual(normalizeLanguageCode("ta"), "ta-IN");
  assert.strictEqual(normalizeLanguageCode("te"), "te-IN");
  assert.strictEqual(normalizeLanguageCode("gu"), "gu-IN");
  assert.strictEqual(normalizeLanguageCode("kn"), "kn-IN");
  assert.strictEqual(normalizeLanguageCode("pa"), "pa-IN");
  assert.strictEqual(normalizeLanguageCode("en"), "en-IN");
  assert.strictEqual(normalizeLanguageCode(undefined), "en-IN");

  // 2. Marathi deterministic weather response
  const mrResponse = await processWeatherQuery("आज हवामान कसे आहे?", "Pune", "mr-IN");
  assert.strictEqual(mrResponse.language, "mr-IN");
  assert.ok(
    mrResponse.answerText.includes("सध्याचे तापमान") || mrResponse.answerText.includes("हवामान"),
    `Marathi response should contain Marathi phrasing, got: ${mrResponse.answerText}`
  );

  // 3. Marathi deterministic rainfall response
  const mrRainResponse = await processWeatherQuery("आज पाऊस पडेल का?", "Pune", "mr");
  assert.strictEqual(mrRainResponse.language, "mr-IN");
  assert.ok(
    mrRainResponse.answerText.includes("पावसाची") || mrRainResponse.answerText.includes("पाऊस"),
    `Marathi rainfall response should contain Marathi phrasing, got: ${mrRainResponse.answerText}`
  );

  // 4. Bengali deterministic weather response
  const bnResponse = await processWeatherQuery("আজকের আবহাওয়া কেমন?", "Kolkata", "bn-IN");
  assert.strictEqual(bnResponse.language, "bn-IN");
  assert.ok(
    bnResponse.answerText.includes("বর্তমান তাপমাত্রা") || bnResponse.answerText.includes("আবহাওয়া"),
    `Bengali response should contain Bengali phrasing, got: ${bnResponse.answerText}`
  );

  // 5. Bengali deterministic rainfall response
  const bnRainResponse = await processWeatherQuery("আজ কি বৃষ্টি হবে?", "Kolkata", "bn");
  assert.strictEqual(bnRainResponse.language, "bn-IN");
  assert.ok(
    bnRainResponse.answerText.includes("বৃষ্টি") || bnRainResponse.answerText.includes("বৃষ্টির"),
    `Bengali rainfall response should contain Bengali phrasing, got: ${bnRainResponse.answerText}`
  );

  // 6. Shared multilingual crisis detection in pipeline.ts (M9)
  const mrCrisis = extractLocationAndTime([], "मला जगायचं नाही, आत्महत्या करावी वाटते");
  assert.strictEqual(mrCrisis.intent, "crisis", "Marathi crisis message must resolve intent to crisis in pipeline.ts");

  const bnCrisis = extractLocationAndTime([], "আমি আত্মহত্যা করতে চাই");
  assert.strictEqual(bnCrisis.intent, "crisis", "Bengali crisis message must resolve intent to crisis in pipeline.ts");

  const enCrisis = extractLocationAndTime([], "I feel hopeless and want to end my life");
  assert.strictEqual(enCrisis.intent, "crisis", "English crisis message must resolve intent to crisis in pipeline.ts");

  // 7. Tele MANAS responses in Marathi and Bengali
  const mrTeleManas = await processWeatherQuery("आत्महत्या करावी वाटते", "Pune", "mr-IN");
  assert.strictEqual(mrTeleManas.isCrisisIntervention, true);
  assert.ok(mrTeleManas.answerText.includes("टेली-मानस") || mrTeleManas.answerText.includes("14416"));

  const bnTeleManas = await processWeatherQuery("আমি মরতে চাই", "Kolkata", "bn-IN");
  assert.strictEqual(bnTeleManas.isCrisisIntervention, true);
  assert.ok(bnTeleManas.answerText.includes("টেলি-মানস") || bnTeleManas.answerText.includes("14416"));

  console.log("✅ Gate G23 Passed: Multilingual deterministic pipeline and shared crisis engine verified.");
}

if (process.argv[1]?.endsWith("multilingual-pipeline.test.ts")) {
  runMultilingualPipelineTests().catch((err) => {
    console.error("G23 Failed:", err);
    process.exit(1);
  });
}
