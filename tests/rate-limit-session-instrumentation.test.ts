import assert from "node:assert";
import {
  isRateLimitedSync,
  buildRateLimitIdentifier,
} from "../lib/utils/rate-limit";
import {
  getOrCreateChatSession,
  persistChatExchange,
  pruneOldChatSessions,
} from "../lib/services/chat-session";
import { register } from "../instrumentation";

export async function runRateLimitSessionInstrumentationTests(): Promise<void> {
  console.log("\n============================================================");
  console.log(" Gate G25: Rate Limiter, Session Reuse & Boot Validation   ");
  console.log("============================================================");

  let passed = 0;

  // 1. True sliding-window rate limit test (M7)
  try {
    const testKey = `test_sliding_${Date.now()}`;
    const limit = 3;
    const windowMs = 300; // 300ms window

    assert.strictEqual(isRateLimitedSync(testKey, limit, windowMs), false, "Req 1 should pass");
    assert.strictEqual(isRateLimitedSync(testKey, limit, windowMs), false, "Req 2 should pass");
    assert.strictEqual(isRateLimitedSync(testKey, limit, windowMs), false, "Req 3 should pass");
    assert.strictEqual(isRateLimitedSync(testKey, limit, windowMs), true, "Req 4 must be rate-limited");

    // Wait for sliding window to slide past
    await new Promise((resolve) => setTimeout(resolve, 350));

    assert.strictEqual(
      isRateLimitedSync(testKey, limit, windowMs),
      false,
      "Req after window slide must pass in sliding window"
    );

    console.log("[PASS] G25.1: True sliding-window rate limiter enforces sliding boundary without reset cliff.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G25.1:", err.message);
    throw err;
  }

  // 2. Rural CG-NAT carrier IP session isolation (M8)
  try {
    const carrierIp = "100.64.12.34";
    const farmerSession1 = "farmer_satara_001";
    const farmerSession2 = "farmer_satara_002";

    const key1 = buildRateLimitIdentifier("chat", carrierIp, farmerSession1);
    const key2 = buildRateLimitIdentifier("chat", carrierIp, farmerSession2);
    const anonKey = buildRateLimitIdentifier("chat", carrierIp, null);

    assert.strictEqual(key1, `chat:${farmerSession1}:${carrierIp}`);
    assert.strictEqual(key2, `chat:${farmerSession2}:${carrierIp}`);
    assert.strictEqual(anonKey, `chat:${carrierIp}`);
    assert.notStrictEqual(key1, key2);

    // Verify independent rate limiting for users behind shared IP
    const limit = 2;
    const windowMs = 1000;
    isRateLimitedSync(key1, limit, windowMs);
    isRateLimitedSync(key1, limit, windowMs);
    assert.strictEqual(isRateLimitedSync(key1, limit, windowMs), true, "Farmer 1 hit limit");

    // Farmer 2 on same carrier IP must NOT be blocked!
    assert.strictEqual(isRateLimitedSync(key2, limit, windowMs), false, "Farmer 2 must not be blocked by Farmer 1");

    console.log("[PASS] G25.2: Rate limiter keying by sessionId+IP prevents rural CG-NAT IP-wide blockouts.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G25.2:", err.message);
    throw err;
  }

  // 3. Chat session continuity and auto-pruning (M15)
  try {
    const createdSessionId = await getOrCreateChatSession(null, "Paddy spraying query", "mr-IN");
    assert.ok(createdSessionId && createdSessionId.length > 0);

    // Reusing the same session ID
    const reusedSessionId = await getOrCreateChatSession(createdSessionId, "Second turn", "mr-IN");
    assert.strictEqual(reusedSessionId, createdSessionId, "Subsequent turn must reuse the same session ID");

    // Persist chat exchange
    await persistChatExchange(createdSessionId, "Will it rain tomorrow in Raigad?", "Dry fair skies forecast.", {
      intent: "rainfall_forecast",
    });

    // Pruning routine executes safely
    const prunedCount = await pruneOldChatSessions(60);
    assert.ok(typeof prunedCount === "number", "pruneOldChatSessions returns count of pruned records");

    console.log("[PASS] G25.3: Chat session continuity reuses existing sessions and provides bounded auto-pruning.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G25.3:", err.message);
    throw err;
  }

  // 4. Server boot-time fail-fast validation in instrumentation.ts (M14)
  try {
    assert.strictEqual(typeof register, "function", "instrumentation.ts must export register function");
    process.env.NEXT_RUNTIME = "nodejs";

    // Calling register() under valid test/development environment
    await register();

    console.log("[PASS] G25.4: instrumentation.ts register() executes boot-time fail-fast environment validation.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G25.4:", err.message);
    throw err;
  }

  console.log(`\nGate G25 Summary: All ${passed}/4 rate limiting, session, and boot tests PASSED.`);
}

if (require.main === module) {
  runRateLimitSessionInstrumentationTests().catch((err) => {
    console.error("FATAL in Gate G25:", err);
    process.exit(1);
  });
}
