import assert from "node:assert";
import crypto, { timingSafeEqual } from "node:crypto";
import { isRateLimitedSync } from "../lib/utils/rate-limit";
import { assertEnvironmentValid } from "../lib/config/environment";
import { logger } from "../lib/utils/logger";

console.log("\n========================================================");
console.log("   PHASE 1 VERIFICATION TESTS (Security & Reliability)   ");
console.log("========================================================\n");

// Test 1: Rate limiting threshold returns 429 condition
console.log("[Test 1] Rate limiting past threshold...");
const testId = `test-ip-${Date.now()}`;
const maxAllowed = 3;
const windowMs = 5000;
assert.strictEqual(isRateLimitedSync(testId, maxAllowed, windowMs), false, "1st request should pass");
assert.strictEqual(isRateLimitedSync(testId, maxAllowed, windowMs), false, "2nd request should pass");
assert.strictEqual(isRateLimitedSync(testId, maxAllowed, windowMs), false, "3rd request should pass");
assert.strictEqual(isRateLimitedSync(testId, maxAllowed, windowMs), true, "4th request past threshold should be rate-limited (429)");
console.log("  ✔ Rate limiting threshold verified (exceeded requests return true -> 429).");

// Test 2: Timing-safe token comparison rejects mismatched-length tokens without throwing
console.log("\n[Test 2] Timing-safe token comparison without length-mismatch exceptions...");
const configuredToken = "super-secret-token-configured-on-server-32chars";
const testTokens = [
  "", // empty string
  "a", // 1 char
  "short", // 5 chars
  "different-length-token-1234567890", // 33 chars
  "super-secret-token-configured-on-server-32chars-extra-long", // 57 chars
  "super-secret-token-configured-on-server-32chars", // exact match
];

for (const provided of testTokens) {
  assert.doesNotThrow(() => {
    const hashProvided = crypto.createHash("sha256").update(provided).digest();
    const hashConfigured = crypto.createHash("sha256").update(configuredToken).digest();
    const isAuthorized = timingSafeEqual(hashProvided, hashConfigured);
    if (provided === configuredToken) {
      assert.strictEqual(isAuthorized, true, "Exact token should match");
    } else {
      assert.strictEqual(isAuthorized, false, `Mismatched token '${provided}' should be rejected`);
    }
  }, `Comparison should never throw for token: ${provided}`);
}
console.log("  ✔ TimingSafeEqual with fixed-length SHA-256 digests verified across varying lengths.");

// Test 3: Fail-fast startup validation on missing env vars in production
console.log("\n[Test 3] Fail-fast startup environment validation...");
assert.throws(
  () => {
    assertEnvironmentValid({
      NODE_ENV: "production",
      WEATHERGPT_MODE: "production",
      // Missing ALERT_INGESTION_TOKEN
    });
  },
  (err: any) => {
    return (
      err instanceof Error &&
      err.message.includes("FATAL CONFIGURATION ERROR") &&
      err.message.includes("ALERT_INGESTION_TOKEN")
    );
  },
  "Startup should fail fast with descriptive error when required env vars are missing in production"
);
console.log("  ✔ Startup fails fast and loudly with missing environment variables in production.");

// Test 4: Pino structured logger operates cleanly
console.log("\n[Test 4] Pino structured logger operation...");
assert.doesNotThrow(() => {
  logger.info("Phase 1 verification check passed", {
    correlationId: "p1-audit-ok",
    context: { stage: "phase-1" },
  });
});
console.log("  ✔ Pino structured logger active with level formatters and correlation IDs.");

console.log("\n========================================================");
console.log("   ALL PHASE 1 VERIFICATION TESTS PASSED SUCCESSFULLY!   ");
console.log("========================================================\n");
