import assert from "node:assert";
import {
  sanitizePhoneNumber,
  maskPhoneNumber,
  isSmsGatewayConfigured,
  isIvrGatewayConfigured,
  dispatchSmsAlert,
  dispatchIvrAlert,
  sendSmsGatewayStub,
  sendIvrGatewayStub,
  routeWarningDissemination,
  routeWarningDisseminationAsync,
  IMDWarningProduct,
} from "../lib/services/alerts";

export async function runSmsIvrDisseminationTests(): Promise<void> {
  console.log("\n==========================================");
  console.log(" Gate G24: SMS & IVR Dissemination Suite  ");
  console.log("==========================================");

  let passed = 0;

  // 1. Phone sanitization and PII masking
  try {
    assert.strictEqual(sanitizePhoneNumber("+91 98765-43210"), "+919876543210");
    assert.strictEqual(sanitizePhoneNumber("9876543210"), "9876543210");
    assert.strictEqual(sanitizePhoneNumber("+1 (555) 234-5678"), "+15552345678");
    assert.strictEqual(sanitizePhoneNumber("123"), null);
    assert.strictEqual(sanitizePhoneNumber("abcdef"), null);

    assert.strictEqual(maskPhoneNumber("+919876543210"), "+91******3210");
    assert.strictEqual(maskPhoneNumber("9876543210"), "987***3210");
    assert.strictEqual(maskPhoneNumber("123"), "****");
    console.log("[PASS] G24.1: Phone sanitization and PII masking correctly protect subscriber numbers.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G24.1:", err.message);
    throw err;
  }

  // 2. Unconfigured behavior: honest stubbing and flags
  const originalEnv = { ...process.env };
  try {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_FROM;
    delete process.env.SMS_GATEWAY_URL;
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.IVR_GATEWAY_URL;

    assert.strictEqual(isSmsGatewayConfigured(), false);
    assert.strictEqual(isIvrGatewayConfigured(), false);

    const smsReceipt = await dispatchSmsAlert("+919876543210", "Red alert warning");
    assert.strictEqual(smsReceipt.status, "STUBBED");
    assert.strictEqual(smsReceipt.provider, "STUB");
    assert.strictEqual(smsReceipt.recipient, "+91******3210");

    const ivrReceipt = await dispatchIvrAlert("+919876543210", "Red alert warning");
    assert.strictEqual(ivrReceipt.status, "STUBBED");
    assert.strictEqual(ivrReceipt.provider, "STUB");

    // Test warning dissemination channel flags when unconfigured
    const testSevereAlert: IMDWarningProduct = {
      id: "test_sev_alert_1",
      alertHash: "hash_sev_1",
      sourceId: "src_1",
      districtCode: "MH-RAIGAD",
      district: "Raigad",
      severity: "Severe",
      headline: "Severe Cyclone",
      warningText: "Severe squall alert",
      sourceProduct: "IMD Mausam",
      issueTime: "2026-09-16T12:00:00Z",
      validFrom: "2026-09-16T12:00:00Z",
      validTo: "2026-09-16T15:00:00Z",
      isActive: true,
    };

    const dis = routeWarningDissemination(testSevereAlert, ["+919876543210"]);
    assert.strictEqual(dis.channels.smsStubbed, true, "smsStubbed must be true when gateway unconfigured");
    assert.strictEqual(dis.channels.ivrStubbed, true, "ivrStubbed must be true when voice gateway unconfigured");
    assert.strictEqual(dis.channels.smsSent, false);
    assert.strictEqual(dis.channels.ivrSent, false);

    console.log("[PASS] G24.2: Unconfigured gateway returns honest STUBBED status and channel flags.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G24.2:", err.message);
    throw err;
  } finally {
    process.env = { ...originalEnv };
  }

  // 3. Configured Twilio dispatch and retry logic (mocking fetch)
  const originalFetch = global.fetch;
  try {
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.SMS_GATEWAY_URL;
    process.env.TWILIO_ACCOUNT_SID = "AC_test_account_sid_123456789";
    process.env.TWILIO_AUTH_TOKEN = "auth_token_secret_12345";
    process.env.TWILIO_PHONE_NUMBER = "+15005550006";

    assert.strictEqual(isSmsGatewayConfigured(), true);
    assert.strictEqual(isIvrGatewayConfigured(), true);

    let fetchCalls: Array<{ url: string; body: string; headers: any }> = [];

    // Mock successful fetch on first attempt
    global.fetch = (async (url: any, options: any) => {
      fetchCalls.push({ url: String(url), body: String(options?.body), headers: options?.headers });
      return {
        ok: true,
        status: 201,
        json: async () => ({ sid: "SM_mock_sid_98765" }),
        text: async () => JSON.stringify({ sid: "SM_mock_sid_98765" }),
      } as any;
    }) as any;

    const receipt = await dispatchSmsAlert("+919876543210", "Severe flood alert");
    assert.strictEqual(receipt.status, "SENT");
    assert.strictEqual(receipt.provider, "TWILIO");
    assert.strictEqual(receipt.messageId, "SM_mock_sid_98765");
    assert.strictEqual(receipt.attempts, 1);
    assert.ok(fetchCalls[0].url.includes("AC_test_account_sid_123456789/Messages.json"));
    assert.ok(fetchCalls[0].body.includes("To=%2B919876543210"));

    console.log("[PASS] G24.3: Configured Twilio SMS gateway correctly dispatches via REST API.");
    passed++;

    // 4. Retry handling on transient 500 error
    fetchCalls = [];
    let callCount = 0;
    global.fetch = (async (url: any, options: any) => {
      callCount++;
      fetchCalls.push({ url: String(url), body: String(options?.body), headers: options?.headers });
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        } as any;
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({ sid: "SM_mock_retried_sid" }),
        text: async () => JSON.stringify({ sid: "SM_mock_retried_sid" }),
      } as any;
    }) as any;

    const retryReceipt = await dispatchSmsAlert("+919876543210", "Squall alert", { maxRetries: 2, timeoutMs: 1000 });
    assert.strictEqual(retryReceipt.status, "SENT");
    assert.strictEqual(retryReceipt.attempts, 2, "Should succeed on second attempt after 500 retry");
    assert.strictEqual(retryReceipt.messageId, "SM_mock_retried_sid");

    console.log("[PASS] G24.4: Transient 5xx errors automatically retry with backoff and succeed.");
    passed++;

    // 5. Asynchronous dissemination with live gateway
    const testAlert: IMDWarningProduct = {
      id: "test_live_dispatch_1",
      alertHash: "hash_live_1",
      sourceId: "src_live",
      districtCode: "MH-RAIGAD",
      district: "Raigad",
      severity: "Severe",
      headline: "Flash Flood Warning",
      warningText: "Severe squall alert",
      sourceProduct: "IMD Mausam",
      issueTime: "2026-09-16T12:00:00Z",
      validFrom: "2026-09-16T12:00:00Z",
      validTo: "2026-09-16T15:00:00Z",
      isActive: true,
    };

    global.fetch = (async () => ({
      ok: true,
      status: 201,
      json: async () => ({ sid: "LIVE_SID_OK" }),
      text: async () => JSON.stringify({ sid: "LIVE_SID_OK" }),
    })) as any;

    const asyncResult = await routeWarningDisseminationAsync(testAlert, ["+919876543210"]);
    assert.strictEqual(asyncResult.channels.smsSent, true, "smsSent must be true after successful live dispatch");
    assert.strictEqual(asyncResult.channels.smsStubbed, false, "smsStubbed must be false when gateway is live");
    assert.strictEqual(asyncResult.channels.ivrSent, true, "ivrSent must be true after successful live dialer");
    assert.strictEqual(asyncResult.channels.ivrStubbed, false);
    assert.ok(asyncResult.receipts && asyncResult.receipts.length >= 2, "Receipts must be generated for SMS and IVR");

    console.log("[PASS] G24.5: routeWarningDisseminationAsync records receipts and updates channel statuses.");
    passed++;
  } catch (err: any) {
    console.error("[FAIL] G24:", err.message);
    throw err;
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  console.log(`\nGate G24 Summary: All ${passed}/5 SMS & IVR dissemination tests PASSED.`);
}

if (require.main === module) {
  runSmsIvrDisseminationTests().catch((err) => {
    console.error("FATAL in Gate G24:", err);
    process.exit(1);
  });
}
