// WeatherGPT — Alerts & Warnings Service (Production-Grade)
// Handles impact-based warning parsing, provenance preservation, deduplication, and expiration.
// Rules:
// - Verbatim text preserved in rawBulletin; normalized summary in normalizedBulletin
// - Deterministic alertHash = sha256(sourceId + districtCode + issueTime + warningText)
// - Auto-expiration: active iff validFrom <= now <= validTo
// - Zero hardcoded recipient phone numbers
// - Zero silent cross-district alert substitution (Raigad alerts never served for other districts)

import crypto from "node:crypto";
import sampleAlerts from "../data/sample-alerts.json";
import { normalizeImdTimestamp } from "../utils/time";
import { findDistrictInfo } from "../utils/location";
import { isProduction } from "../config/environment";
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

export interface DisseminationResult {
  alertId: string;
  alertHash: string;
  district: string;
  severity: AlertSeverity;
  displayWarningText: string;
  verbatimWarningText: string;
  channels: {
    inAppBanner: boolean;
    webPush: boolean;
    smsStubbed: boolean;
    ivrStubbed: boolean;
  };
  deliveryLogs: string[];
  skipped?: boolean;
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
): { status: "STUBBED" | "REJECTED"; note: string } {
  const sanitized = sanitizePhoneNumber(recipientPhone);
  if (!sanitized) {
    return {
      status: "REJECTED",
      note: "Invalid phone number format. Must conform to E.164 or valid 10-15 digit phone.",
    };
  }

  const cleanText = verbatimText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 1000);
  const maskedPhone = sanitized.replace(/\d(?=\d{4})/g, "*");
  const logMsg = `[Production SMS Gateway Stub] Dispatched SMS alert to ${maskedPhone}. Gateway requires C-DOT/MoES tie-in. Verbatim length: ${cleanText.length} chars.`;
  console.log(logMsg);
  return {
    status: "STUBBED",
    note: "SMS gateway interface stubbed. Production target requires C-DOT / CDAC SMS tie-in.",
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
): { status: "STUBBED" | "REJECTED"; note: string } {
  const sanitized = sanitizePhoneNumber(recipientPhone);
  if (!sanitized) {
    return {
      status: "REJECTED",
      note: "Invalid phone number format. Must conform to E.164 or valid 10-15 digit phone.",
    };
  }

  const cleanText = verbatimText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 1000);
  const maskedPhone = sanitized.replace(/\d(?=\d{4})/g, "*");
  const logMsg = `[Production IVR Gateway Stub] Dispatched IVR call to ${maskedPhone}. Verbatim length: ${cleanText.length} chars.`;
  console.log(logMsg);
  return {
    status: "STUBBED",
    note: "IVR voice gateway interface stubbed. Production target requires PSTN rural dialer setup.",
  };
}

/**
 * Disseminate an IMD warning product across severity tiers.
 * Idempotent: checks alertHash against dispatchedAlertHashes to prevent duplicate notifications.
 */
export function routeWarningDissemination(
  warning: IMDWarningProduct,
  matchedUserPhones: string[] = []
): DisseminationResult {
  const logs: string[] = [];
  const channels = {
    inAppBanner: true,
    webPush: false,
    smsStubbed: false,
    ivrStubbed: false,
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
        ivrStubbed: false,
      },
      deliveryLogs: logs,
      skipped: true,
    };
  }

  pruneDispatchedAlertHashes();
  dispatchedAlertHashes.set(warning.alertHash, Date.now());
  logs.push(`Alert ${warning.id} received for district ${warning.district} with severity [${warning.severity}].`);

  switch (warning.severity) {
    case "Low":
      channels.inAppBanner = true;
      logs.push("Tier Low: Dispatched to In-App Notification Banner.");
      break;

    case "Moderate":
      channels.inAppBanner = true;
      channels.webPush = true;
      logs.push("Tier Moderate: Dispatched to In-App Banner + Web Push notification.");
      break;

    case "High":
      channels.inAppBanner = true;
      channels.webPush = true;
      channels.smsStubbed = true;
      logs.push("Tier High: Dispatched to In-App Banner + Web Push + SMS Gateway (STUBBED).");
      for (const phone of matchedUserPhones) {
        if (phone) sendSmsGatewayStub(phone, warning.warningText);
      }
      break;

    case "Severe":
      channels.inAppBanner = true;
      channels.webPush = true;
      channels.smsStubbed = true;
      channels.ivrStubbed = true;
      logs.push("Tier Severe: Dispatched to In-App Banner + Web Push + SMS Gateway (STUBBED) + IVR Dialer (STUBBED).");
      for (const phone of matchedUserPhones) {
        if (phone) {
          sendSmsGatewayStub(phone, warning.warningText);
          sendIvrGatewayStub(phone, warning.warningText);
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
    console.warn("Live IMD nowcast fetch failed:", err);
  }

  // In production, do not return fake sample alerts for another district!
  if (isProduction()) {
    return [];
  }

  // In demo mode only: match sample alerts strictly by district
  const demoAlerts = (sampleAlerts as any[]).filter((a) => {
    const dMatch = a.district.toLowerCase() === districtName.toLowerCase();
    if (!stateName) return dMatch;
    return dMatch && (!a.state || a.state.toLowerCase() === stateName.toLowerCase());
  }).map((a) => {
    const hash = computeAlertHash(a.id || "sample", districtCode, a.issueTime || new Date().toISOString(), a.warningText);
    return {
      ...a,
      alertHash: hash,
      districtCode,
      sourceId: a.id || "sample",
      rawBulletin: a.warningText,
      normalizedBulletin: a.warningText,
    } as IMDWarningProduct;
  }).filter((a) => isAlertActive(a));

  return demoAlerts;
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

  if (isProduction()) {
    return [];
  }

  return (sampleAlerts as any[])
    .filter((a) => a.district.toLowerCase() === district.toLowerCase())
    .map((a) => ({
      ...a,
      alertHash: computeAlertHash(a.id || "sample", districtCode, a.issueTime || "", a.warningText),
      districtCode,
      sourceId: a.id || "sample",
    }))
    .filter((a) => isAlertActive(a as IMDWarningProduct));
}
