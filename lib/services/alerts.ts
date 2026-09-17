// WeatherGPT — Alerts & Warnings Service (Production-Grade)
// Handles impact-based warning parsing, provenance preservation, deduplication, and expiration.
// Rules:
// - Verbatim text preserved in rawBulletin; normalized summary in normalizedBulletin
// - Deterministic alertHash = sha256(sourceId + districtCode + issueTime + warningText)
// - Auto-expiration: active iff validFrom <= now <= validTo
// - Zero hardcoded recipient phone numbers
// - Zero silent cross-district alert substitution (Raigad alerts never served for other districts)

import crypto from "node:crypto";
import { normalizeImdTimestamp } from "../utils/time";
import { findDistrictInfo } from "../utils/location";
import { isProduction } from "../config/environment";
import { logger } from "../utils/logger";
import {
  extractNowcastAreas,
  parseNowcastAreaInfo,
  findBestMatchingNowcastArea,
  getImdParserHealth,
  ImdNowcastArea,
} from "./imd-nowcast-parser";
import { DEFAULT_DISTRICT } from "../config/constants";

export type AlertSeverity = "Low" | "Moderate" | "High" | "Severe";

export interface IMDWarningProduct {
  id: string;
  alertHash: string;
  sourceId: string;
  districtCode: string;
  district: string;
  state?: string;
  severity: AlertSeverity;
  officialSeverity?: string; // "Red" | "Orange" | "Yellow" | "Green"
  eventType?: string;
  headline: string;
  warningText: string; // display bulletin
  rawBulletin?: string; // untouched source bulletin
  normalizedBulletin?: string; // structured summary
  sourceProduct: string;
  sourceUrl?: string;
  issueTime: string;
  validFrom: string;
  validTo: string;
  validUntilEstimated?: boolean;
  isActive: boolean;
}

export interface DeliveryReceipt {
  recipient: string; // Masked for PII safety (e.g. +91*****0001)
  channel: "SMS" | "IVR";
  status: "SENT" | "STUBBED" | "FAILED" | "REJECTED";
  provider: "TWILIO" | "MSG91" | "GENERIC_WEBHOOK" | "STUB";
  messageId?: string;
  attempts: number;
  error?: string;
  timestamp: string;
}

export interface DisseminationResult {
  alertId: string;
  alertHash: string;
  district: string;
  severity: AlertSeverity;
  displayWarningText: string;
  verbatimWarningText: string;
  channels: {
    inAppBanner: boolean; // Flagged for client web app polling /api/alerts
    webPush: boolean;
    smsStubbed: boolean;
    smsSent?: boolean;
    ivrStubbed: boolean;
    ivrSent?: boolean;
  };
  deliveryLogs: string[];
  receipts?: DeliveryReceipt[];
  skipped?: boolean;
}

interface SampleAlertItem {
  id: string;
  district: string;
  state?: string;
  severity: AlertSeverity;
  officialSeverity?: string;
  eventType?: string;
  headline: string;
  warningText: string;
  issueTime?: string;
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
}

// Global caches & deduplication registry
let imdNowcastAreasCache: { areas: ImdNowcastArea[]; cachedAt: number } | null = null;
let imdNowcastInFlight: Promise<ImdNowcastArea[]> | null = null;
const liveDistrictAlertsCache = new Map<string, { alerts: IMDWarningProduct[]; cachedAt: number }>();
const dispatchedAlertHashes = new Map<string, number>(); // alertHash -> timestamp
const MAX_DISPATCHED_HASHES = 5000;
const HASH_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour TTL pruning

function pruneDispatchedAlertHashes(): void {
  const now = Date.now();
  dispatchedAlertHashes.forEach((timestamp, hash) => {
    if (now - timestamp > HASH_TTL_MS) {
      dispatchedAlertHashes.delete(hash);
    }
  });
  if (dispatchedAlertHashes.size > MAX_DISPATCHED_HASHES) {
    const overflow = dispatchedAlertHashes.size - MAX_DISPATCHED_HASHES;
    let count = 0;
    for (const key of Array.from(dispatchedAlertHashes.keys())) {
      if (count++ >= overflow) break;
      dispatchedAlertHashes.delete(key);
    }
  }
}

/**
 * Computes deterministic SHA-256 hash for alert deduplication and idempotency
 * sha256( sourceId + districtCode + issueTime + warningText )
 */
export function computeAlertHash(
  sourceId: string,
  districtCode: string,
  issueTime: string,
  warningText: string
): string {
  const payload = `${sourceId.trim()}|${districtCode.trim().toUpperCase()}|${issueTime.trim()}|${warningText.trim()}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Evaluates whether an alert is currently active based on validFrom <= now <= validTo
 */
export function isAlertActive(alert: IMDWarningProduct, now: Date = new Date()): boolean {
  try {
    const validFromTime = new Date(alert.validFrom).getTime();
    const validToTime = new Date(alert.validTo).getTime();
    const currentTime = now.getTime();

    if (isNaN(validFromTime) || isNaN(validToTime)) {
      return alert.isActive;
    }

    return currentTime >= validFromTime && currentTime <= validToTime;
  } catch {
    return alert.isActive;
  }
}

/**
 * Fetches all district nowcast bulletins directly from the IMD Mausam Portal
 */
async function fetchLiveImdNowcastAreas(): Promise<ImdNowcastArea[]> {
  const CACHE_TTL = 5 * 60 * 1000;
  if (imdNowcastAreasCache && Date.now() - imdNowcastAreasCache.cachedAt < CACHE_TTL) {
    return imdNowcastAreasCache.areas;
  }
  if (imdNowcastInFlight) {
    return imdNowcastInFlight;
  }

  imdNowcastInFlight = (async () => {
    try {
      const res = await fetch("https://mausam.imd.gov.in/responsive/districtWiseNowcast.php", {
        headers: { "User-Agent": "WeatherGPT-OpenData/1.0 (+https://github.com/rachts/WEATHERGPT)" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) {
        return imdNowcastAreasCache ? imdNowcastAreasCache.areas : [];
      }
      const text = await res.text();
      const areas = extractNowcastAreas(text);
      if (Array.isArray(areas) && areas.length > 0) {
        imdNowcastAreasCache = { areas, cachedAt: Date.now() };
      }
      return areas;
    } catch {
      return imdNowcastAreasCache ? imdNowcastAreasCache.areas : [];
    } finally {
      imdNowcastInFlight = null;
    }
  })();

  return imdNowcastInFlight;
}

/**
 * Masks phone numbers to avoid logging PII (+919876543210 -> +91*****3210)
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "****";
  const start = cleaned.slice(0, 3);
  const end = cleaned.slice(-4);
  return `${start}${"*".repeat(Math.max(0, cleaned.length - 7))}${end}`;
}

/**
 * Checks whether live SMS dissemination credentials are configured.
 */
export function isSmsGatewayConfigured(): boolean {
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM)
  );
  const hasWebhook = Boolean(process.env.SMS_GATEWAY_URL);
  const hasMsg91 = Boolean(process.env.MSG91_AUTH_KEY);
  return hasTwilio || hasWebhook || hasMsg91;
}

/**
 * Checks whether live IVR voice dialer credentials are configured.
 */
export function isIvrGatewayConfigured(): boolean {
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM)
  );
  const hasWebhook = Boolean(process.env.IVR_GATEWAY_URL);
  return hasTwilio || hasWebhook;
}

/**
 * Validates and sanitizes phone numbers (E.164 format or standard 10-15 digit mobile).
 */
export function sanitizePhoneNumber(phone: string): string | null {
  const cleaned = phone.trim().replace(/[\s\-()]/g, "");
  if (!/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * PRODUCTION GATEWAY STUB: SMS Dissemination
 * Sanitizes phone numbers and cleans control characters.
 * NO hardcoded recipients! Recipient phone must be provided by authenticated subscriber.
 */
export function sendSmsGatewayStub(
  recipientPhone: string,
  verbatimText: string
): { status: "STUBBED" | "REJECTED"; note: string; receipt: DeliveryReceipt } {
  const sanitized = sanitizePhoneNumber(recipientPhone);
  if (!sanitized) {
    return {
      status: "REJECTED",
      note: "Invalid phone number format. Must conform to E.164 or valid 10-15 digit phone.",
      receipt: {
        recipient: maskPhoneNumber(recipientPhone),
        channel: "SMS",
        status: "REJECTED",
        provider: "STUB",
        attempts: 0,
        error: "Invalid phone number format",
        timestamp: new Date().toISOString(),
      },
    };
  }

  const cleanText = verbatimText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 1000);
  const maskedPhone = maskPhoneNumber(sanitized);
  logger.info("SMS alert dispatch stubbed (no gateway configured)", {
    recipient: maskedPhone,
    textLength: cleanText.length,
    provider: "STUB",
  });
  return {
    status: "STUBBED",
    note: "SMS gateway interface stubbed. Set TWILIO_ACCOUNT_SID / SMS_GATEWAY_URL for live dispatch.",
    receipt: {
      recipient: maskedPhone,
      channel: "SMS",
      status: "STUBBED",
      provider: "STUB",
      attempts: 1,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * PRODUCTION GATEWAY STUB: Outbound IVR Dialer
 * Sanitizes phone numbers and cleans control characters.
 * NO hardcoded recipients! Recipient phone must be provided by authenticated subscriber.
 */
export function sendIvrGatewayStub(
  recipientPhone: string,
  verbatimText: string
): { status: "STUBBED" | "REJECTED"; note: string; receipt: DeliveryReceipt } {
  const sanitized = sanitizePhoneNumber(recipientPhone);
  if (!sanitized) {
    return {
      status: "REJECTED",
      note: "Invalid phone number format. Must conform to E.164 or valid 10-15 digit phone.",
      receipt: {
        recipient: maskPhoneNumber(recipientPhone),
        channel: "IVR",
        status: "REJECTED",
        provider: "STUB",
        attempts: 0,
        error: "Invalid phone number format",
        timestamp: new Date().toISOString(),
      },
    };
  }

  const cleanText = verbatimText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 1000);
  const maskedPhone = maskPhoneNumber(sanitized);
  logger.info("IVR voice alert dispatch stubbed (no voice gateway configured)", {
    recipient: maskedPhone,
    textLength: cleanText.length,
    provider: "STUB",
  });
  return {
    status: "STUBBED",
    note: "IVR voice gateway interface stubbed. Set TWILIO_ACCOUNT_SID / IVR_GATEWAY_URL for live dialer.",
    receipt: {
      recipient: maskedPhone,
      channel: "IVR",
      status: "STUBBED",
      provider: "STUB",
      attempts: 1,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Dispatches a real SMS alert via Twilio, MSG91, or custom webhook.
 * Automatically retries transient 5xx errors with backoff.
 * Falls back cleanly to honest stub receipt when no gateway is configured.
 */
export async function dispatchSmsAlert(
  recipientPhone: string,
  verbatimText: string,
  options: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<DeliveryReceipt> {
  const sanitized = sanitizePhoneNumber(recipientPhone);
  if (!sanitized) {
    return {
      recipient: maskPhoneNumber(recipientPhone),
      channel: "SMS",
      status: "REJECTED",
      provider: "STUB",
      attempts: 0,
      error: "Invalid phone number format.",
      timestamp: new Date().toISOString(),
    };
  }

  const cleanText = verbatimText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 1000);
  const maskedPhone = maskPhoneNumber(sanitized);
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 5000;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;
  const gatewayUrl = process.env.SMS_GATEWAY_URL;

  // 1. Twilio live SMS dispatch
  if (twilioSid && twilioAuth && twilioFrom) {
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const basicAuth = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64");
        const bodyParams = new URLSearchParams({
          To: sanitized,
          From: twilioFrom,
          Body: cleanText,
        });

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: bodyParams.toString(),
            signal: AbortSignal.timeout(timeoutMs),
          }
        );

        if (res.ok) {
          const data = (await res.json()) as { sid?: string };
          logger.info("Dispatched live SMS via Twilio", {
            recipient: maskedPhone,
            messageSid: data.sid,
            attempts: attempt,
          });
          return {
            recipient: maskedPhone,
            channel: "SMS",
            status: "SENT",
            provider: "TWILIO",
            messageId: data.sid,
            attempts: attempt,
            timestamp: new Date().toISOString(),
          };
        }

        const errText = await res.text();
        lastError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        if (res.status < 500) break; // Don't retry 4xx errors
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    logger.error("Failed to dispatch live SMS via Twilio after retries", {
      recipient: maskedPhone,
      error: lastError,
      attempts: attempt,
    });
    return {
      recipient: maskedPhone,
      channel: "SMS",
      status: "FAILED",
      provider: "TWILIO",
      attempts: attempt,
      error: lastError,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Generic HTTP webhook SMS dispatch
  if (gatewayUrl) {
    let attempt = 0;
    let lastError: string | undefined;
    const apiKey = process.env.SMS_GATEWAY_API_KEY;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const res = await fetch(gatewayUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ to: sanitized, message: cleanText }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string };
          logger.info("Dispatched live SMS via custom webhook", {
            recipient: maskedPhone,
            attempts: attempt,
          });
          return {
            recipient: maskedPhone,
            channel: "SMS",
            status: "SENT",
            provider: "GENERIC_WEBHOOK",
            messageId: data.id || data.messageId,
            attempts: attempt,
            timestamp: new Date().toISOString(),
          };
        }

        const errText = await res.text();
        lastError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        if (res.status < 500) break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      recipient: maskedPhone,
      channel: "SMS",
      status: "FAILED",
      provider: "GENERIC_WEBHOOK",
      attempts: attempt,
      error: lastError,
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Fallback to honest stub receipt
  const stubResult = sendSmsGatewayStub(sanitized, cleanText);
  return stubResult.receipt;
}

/**
 * Dispatches a real IVR voice alert via Twilio Voice or custom webhook.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getPollyVoiceForLanguage(lang?: string): { voice: string; languageCode: string } {
  const code = (lang || "").toLowerCase();
  if (code.startsWith("te")) return { voice: "Polly.Chitra", languageCode: "te-IN" };
  if (code.startsWith("en")) return { voice: "Polly.Raveena", languageCode: "en-IN" };
  return { voice: "Polly.Aditi", languageCode: "hi-IN" };
}

export async function dispatchIvrAlert(
  recipientPhone: string,
  verbatimText: string,
  options: { maxRetries?: number; timeoutMs?: number; language?: string } = {}
): Promise<DeliveryReceipt> {
  const sanitized = sanitizePhoneNumber(recipientPhone);
  if (!sanitized) {
    return {
      recipient: maskPhoneNumber(recipientPhone),
      channel: "IVR",
      status: "REJECTED",
      provider: "STUB",
      attempts: 0,
      error: "Invalid phone number format.",
      timestamp: new Date().toISOString(),
    };
  }

  const cleanText = verbatimText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 1000);
  const escapedText = escapeXml(cleanText);
  const maskedPhone = maskPhoneNumber(sanitized);
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 5000;
  const { voice, languageCode } = getPollyVoiceForLanguage(options.language);

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;
  const gatewayUrl = process.env.IVR_GATEWAY_URL;

  if (twilioSid && twilioAuth && twilioFrom) {
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const basicAuth = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64");
        const twiml = `<Response><Pause length="1"/><Say voice="${voice}" language="${languageCode}">${escapedText}</Say></Response>`;
        const bodyParams = new URLSearchParams({
          To: sanitized,
          From: twilioFrom,
          Twiml: twiml,
        });


        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: bodyParams.toString(),
            signal: AbortSignal.timeout(timeoutMs),
          }
        );

        if (res.ok) {
          const data = (await res.json()) as { sid?: string };
          logger.info("Dispatched live IVR voice call via Twilio", {
            recipient: maskedPhone,
            callSid: data.sid,
            attempts: attempt,
          });
          return {
            recipient: maskedPhone,
            channel: "IVR",
            status: "SENT",
            provider: "TWILIO",
            messageId: data.sid,
            attempts: attempt,
            timestamp: new Date().toISOString(),
          };
        }

        const errText = await res.text();
        lastError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        if (res.status < 500) break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      recipient: maskedPhone,
      channel: "IVR",
      status: "FAILED",
      provider: "TWILIO",
      attempts: attempt,
      error: lastError,
      timestamp: new Date().toISOString(),
    };
  }

  if (gatewayUrl) {
    let attempt = 0;
    let lastError: string | undefined;
    const apiKey = process.env.IVR_GATEWAY_API_KEY;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const res = await fetch(gatewayUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ to: sanitized, prompt: cleanText }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { id?: string };
          return {
            recipient: maskedPhone,
            channel: "IVR",
            status: "SENT",
            provider: "GENERIC_WEBHOOK",
            messageId: data.id,
            attempts: attempt,
            timestamp: new Date().toISOString(),
          };
        }

        const errText = await res.text();
        lastError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        if (res.status < 500) break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      recipient: maskedPhone,
      channel: "IVR",
      status: "FAILED",
      provider: "GENERIC_WEBHOOK",
      attempts: attempt,
      error: lastError,
      timestamp: new Date().toISOString(),
    };
  }

  const stubResult = sendIvrGatewayStub(sanitized, cleanText);
  return stubResult.receipt;
}

/**
 * Disseminate an IMD warning product across severity tiers (synchronous entry point).
 * Idempotent: checks alertHash against dispatchedAlertHashes to prevent duplicate notifications.
 */
export function routeWarningDissemination(
  warning: IMDWarningProduct,
  matchedUserPhones: string[] = []
): DisseminationResult {
  const logs: string[] = [];
  const smsConfigured = isSmsGatewayConfigured();
  const ivrConfigured = isIvrGatewayConfigured();

  const channels = {
    // In-App Banner: Web client polls /api/alerts at regular intervals. Setting inAppBanner=true flags this alert for display in the polling response.
    inAppBanner: true,
    webPush: false,
    smsStubbed: !smsConfigured,
    smsSent: false,
    ivrStubbed: !ivrConfigured,
    ivrSent: false,
  };

  // Deduplication check
  if (dispatchedAlertHashes.has(warning.alertHash)) {
    logs.push(`Alert ${warning.id} (hash: ${warning.alertHash.slice(0, 8)}) was already dispatched. Skipping duplicate notification.`);
    return {
      alertId: warning.id,
      alertHash: warning.alertHash,
      district: warning.district,
      severity: warning.severity,
      displayWarningText: warning.warningText,
      verbatimWarningText: warning.rawBulletin || warning.warningText,
      channels: {
        inAppBanner: false,
        webPush: false,
        smsStubbed: false,
        smsSent: false,
        ivrStubbed: false,
        ivrSent: false,
      },
      deliveryLogs: logs,
      skipped: true,
    };
  }

  pruneDispatchedAlertHashes();
  dispatchedAlertHashes.set(warning.alertHash, Date.now());
  logs.push(`Alert ${warning.id} received for district ${warning.district} with severity [${warning.severity}].`);

  const receipts: DeliveryReceipt[] = [];

  switch (warning.severity) {
    case "Low":
      channels.inAppBanner = true;
      channels.smsStubbed = false;
      channels.ivrStubbed = false;
      logs.push("Tier Low: Flagged for client web app polling banner.");
      break;

    case "Moderate":
      channels.inAppBanner = true;
      channels.webPush = true;
      channels.smsStubbed = false;
      channels.ivrStubbed = false;
      logs.push("Tier Moderate: Flagged for In-App Banner + Web Push notification.");
      break;

    case "High":
      channels.inAppBanner = true;
      channels.webPush = true;
      channels.ivrStubbed = false;
      channels.smsStubbed = !smsConfigured;
      channels.smsSent = false; // Synchronous route does not execute live network I/O; see routeWarningDisseminationAsync
      logs.push(`Tier High: Dispatched to In-App Banner + Web Push + SMS Gateway (${smsConfigured ? "Configured for Async Dispatch" : "STUBBED"}).`);
      for (const phone of matchedUserPhones) {
        if (phone) {
          const res = sendSmsGatewayStub(phone, warning.warningText);
          receipts.push(res.receipt);
        }
      }
      break;

    case "Severe":
      channels.inAppBanner = true;
      channels.webPush = true;
      channels.smsStubbed = !smsConfigured;
      channels.smsSent = false;
      channels.ivrStubbed = !ivrConfigured;
      channels.ivrSent = false;
      logs.push(
        `Tier Severe: Dispatched to In-App Banner + Web Push + SMS (${smsConfigured ? "LIVE-READY" : "STUBBED"}) + IVR (${ivrConfigured ? "LIVE-READY" : "STUBBED"}).`
      );
      for (const phone of matchedUserPhones) {
        if (phone) {
          const smsRes = sendSmsGatewayStub(phone, warning.warningText);
          const ivrRes = sendIvrGatewayStub(phone, warning.warningText);
          receipts.push(smsRes.receipt);
          receipts.push(ivrRes.receipt);
        }
      }
      break;
  }

  return {
    alertId: warning.id,
    alertHash: warning.alertHash,
    district: warning.district,
    severity: warning.severity,
    displayWarningText: warning.warningText,
    verbatimWarningText: warning.rawBulletin || warning.warningText,
    channels,
    deliveryLogs: logs,
    receipts,
  };
}

/**
 * Asynchronously disseminates an IMD warning with live external network calls when gateways are configured.
 * Uses Promise.allSettled for concurrent dispatch capped at 50 recipients to prevent serverless timeouts.
 */
export async function routeWarningDisseminationAsync(
  warning: IMDWarningProduct,
  matchedUserPhones: string[] = []
): Promise<DisseminationResult> {
  const baseResult = routeWarningDissemination(warning, []);
  if (baseResult.skipped) {
    return baseResult;
  }

  const receipts: DeliveryReceipt[] = [];
  const logs = [...baseResult.deliveryLogs];
  let smsSent = false;
  let ivrSent = false;

  const validPhones = matchedUserPhones.filter(Boolean).slice(0, 50);

  if ((warning.severity === "High" || warning.severity === "Severe") && validPhones.length > 0) {
    const smsDispatches = await Promise.allSettled(
      validPhones.map((phone) => dispatchSmsAlert(phone, warning.warningText))
    );

    for (const result of smsDispatches) {
      if (result.status === "fulfilled") {
        const receipt = result.value;
        receipts.push(receipt);
        if (receipt.status === "SENT") {
          smsSent = true;
          logs.push(`Dispatched live SMS via ${receipt.provider} to ${receipt.recipient} [ID: ${receipt.messageId || "N/A"}].`);
        } else if (receipt.status === "FAILED") {
          logs.push(`Failed SMS dispatch to ${receipt.recipient}: ${receipt.error}.`);
        }
      } else {
        logs.push(`SMS dispatch promise rejected: ${result.reason?.message || "Unknown error"}.`);
      }
    }
  }

  if (warning.severity === "Severe" && validPhones.length > 0) {
    const ivrDispatches = await Promise.allSettled(
      validPhones.map((phone) => dispatchIvrAlert(phone, warning.warningText))
    );

    for (const result of ivrDispatches) {
      if (result.status === "fulfilled") {
        const receipt = result.value;
        receipts.push(receipt);
        if (receipt.status === "SENT") {
          ivrSent = true;
          logs.push(`Dispatched live IVR voice call via ${receipt.provider} to ${receipt.recipient} [ID: ${receipt.messageId || "N/A"}].`);
        } else if (receipt.status === "FAILED") {
          logs.push(`Failed IVR dispatch to ${receipt.recipient}: ${receipt.error}.`);
        }
      } else {
        logs.push(`IVR dispatch promise rejected: ${result.reason?.message || "Unknown error"}.`);
      }
    }
  }

  return {
    ...baseResult,
    channels: {
      ...baseResult.channels,
      smsSent,
      smsStubbed: !isSmsGatewayConfigured(),
      ivrSent,
      ivrStubbed: !isIvrGatewayConfigured(),
    },
    deliveryLogs: logs,
    receipts,
  };
}


/**
 * Fetches genuine real-time district nowcasts from the official IMD Mausam Portal.
 * Enforces validFrom <= now <= validTo expiration.
 * Never serves alerts of another district!
 */
export async function fetchLiveImdDistrictAlerts(
  district: string = DEFAULT_DISTRICT,
  state?: string
): Promise<IMDWarningProduct[]> {
  const districtInfo = findDistrictInfo(district, state);
  const districtName = districtInfo ? districtInfo.name : district.trim();
  const districtCode = districtInfo ? districtInfo.districtCode : `IN-${district.toUpperCase()}`;
  const stateName = districtInfo ? districtInfo.state : state;

  const cacheKey = districtCode.toLowerCase();
  const cached = liveDistrictAlertsCache.get(cacheKey);
  const CACHE_TTL = 5 * 60 * 1000;

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.alerts.filter((a) => isAlertActive(a));
  }

  try {
    const areas = await fetchLiveImdNowcastAreas();
    if (areas.length > 0) {
      const selectedArea = findBestMatchingNowcastArea(areas, districtName, stateName);

      if (selectedArea) {
        const parsed = parseNowcastAreaInfo(selectedArea.info, selectedArea.color, districtName);
        const sourceId = `imd_nowcast_${selectedArea.id || districtCode}`;
        const alertHash = computeAlertHash(sourceId, districtCode, parsed.issueIso, parsed.warningText);

        const liveAlert: IMDWarningProduct = {
          id: sourceId,
          alertHash,
          sourceId,
          districtCode,
          district: districtName,
          state: stateName,
          severity: parsed.severity,
          officialSeverity: parsed.officialSeverity,
          headline: parsed.headline,
          warningText: parsed.warningText,
          rawBulletin: parsed.rawBulletin,
          normalizedBulletin: parsed.normalizedBulletin,
          sourceProduct: "IMD Mausam District Nowcast Portal (MoES)",
          sourceUrl: "https://mausam.imd.gov.in/responsive/districtWiseNowcast.php",
          issueTime: parsed.issueIso,
          validFrom: parsed.validFromIso,
          validTo: parsed.validToIso,
          validUntilEstimated: parsed.validUntilEstimated,
          isActive: true,
        };

        const result = [liveAlert].filter((a) => isAlertActive(a));
        liveDistrictAlertsCache.set(cacheKey, { alerts: result, cachedAt: Date.now() });
        return result;
      }
    }
  } catch (err) {
    logger.warn("Live IMD nowcast fetch failed", { error: (err as Error).message });
  }

  // Honest return: no active alerts found for this district
  return [];
}

/**
 * Retrieve active alerts for district (synchronous entry point)
 */
export function getActiveDistrictAlerts(district: string = DEFAULT_DISTRICT, state?: string): IMDWarningProduct[] {
  const districtInfo = findDistrictInfo(district, state);
  const districtCode = districtInfo ? districtInfo.districtCode.toLowerCase() : district.trim().toLowerCase();

  const cached = liveDistrictAlertsCache.get(districtCode);
  if (cached) {
    return cached.alerts.filter((a) => isAlertActive(a));
  }

  return [];
}
