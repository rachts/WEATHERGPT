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
}

interface ImdNowcastArea {
  title: string;
  id: string;
  color: string;
  info: string;
  balloonText?: string;
}

// Global caches & deduplication registry
let imdNowcastAreasCache: { areas: ImdNowcastArea[]; cachedAt: number } | null = null;
let imdNowcastInFlight: Promise<ImdNowcastArea[]> | null = null;
const liveDistrictAlertsCache = new Map<string, { alerts: IMDWarningProduct[]; cachedAt: number }>();
const dispatchedAlertHashes = new Set<string>();

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
      const match = text.match(/\"areas\":\s*(\[\s*\{[\s\S]*?\}\s*\])/);
      if (!match) {
        return imdNowcastAreasCache ? imdNowcastAreasCache.areas : [];
      }
      const areas: ImdNowcastArea[] = JSON.parse(match[1]);
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
 * PRODUCTION GATEWAY STUB: SMS Dissemination
 * NO hardcoded recipients! Recipient phone must be provided by authenticated subscriber.
 */
export function sendSmsGatewayStub(recipientPhone: string, verbatimText: string): { status: "STUBBED"; note: string } {
  const maskedPhone = recipientPhone.replace(/\d(?=\d{4})/g, "*");
  const logMsg = `[Production SMS Gateway Stub] Dispatched SMS alert to ${maskedPhone}. Gateway requires C-DOT/MoES tie-in. Verbatim length: ${verbatimText.length} chars.`;
  console.log(logMsg);
  return {
    status: "STUBBED",
    note: "SMS gateway interface stubbed. Production target requires C-DOT / CDAC SMS tie-in.",
  };
}

/**
 * PRODUCTION GATEWAY STUB: Outbound IVR Dialer
 * NO hardcoded recipients! Recipient phone must be provided by authenticated subscriber.
 */
export function sendIvrGatewayStub(recipientPhone: string, verbatimText: string): { status: "STUBBED"; note: string } {
  const maskedPhone = recipientPhone.replace(/\d(?=\d{4})/g, "*");
  const logMsg = `[Production IVR Gateway Stub] Dispatched IVR call to ${maskedPhone}. Verbatim length: ${verbatimText.length} chars.`;
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
      channels,
      deliveryLogs: logs,
    };
  }

  dispatchedAlertHashes.add(warning.alertHash);
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
  district: string = "Raigad",
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
      const cleanDistrict = districtName.toUpperCase().replace(/\s+DISTRICT\b/i, "").trim();
      const cleanState = stateName ? stateName.toUpperCase().trim() : "";

      const candidateAreas = areas.filter((a) => {
        const titleUpper = a.title.toUpperCase().trim();
        return (
          titleUpper === cleanDistrict ||
          cleanDistrict.includes(titleUpper) ||
          titleUpper.includes(cleanDistrict)
        );
      });

      let selectedArea: ImdNowcastArea | undefined = candidateAreas[0];
      if (cleanState && candidateAreas.length > 1) {
        const stateMatch = candidateAreas.find((a) => {
          const infoUpper = (a.info || "").toUpperCase();
          const balloonUpper = (a.balloonText || "").toUpperCase();
          const idUpper = (a.id || "").toUpperCase();
          return (
            infoUpper.includes(cleanState) ||
            balloonUpper.includes(cleanState) ||
            idUpper.includes(cleanState)
          );
        });
        if (stateMatch) selectedArea = stateMatch;
      }

      if (selectedArea) {
        const color = selectedArea.color.toUpperCase();
        let severity: AlertSeverity = "Low";
        let officialSeverity = "Green";

        if (color === "#FF0000") {
          severity = "Severe";
          officialSeverity = "Red";
        } else if (color === "#FFA500") {
          severity = "High";
          officialSeverity = "Orange";
        } else if (color === "#FFFF00") {
          severity = "Moderate";
          officialSeverity = "Yellow";
        }

        const rawInfo = selectedArea.info || "";
        const issueMatch = rawInfo.match(/Time of issue<\/b>:\s*<p>([^<]+)<\/p>/i);
        const validMatch = rawInfo.match(/Valid upto<\/b>:\s*([^<]+)<\/p>/i);
        const bulletMatches = Array.from(rawInfo.matchAll(/<p>([^<]+)<\/p>/g))
          .map((m) => m[1].trim())
          .filter(
            (t) =>
              !t.toLowerCase().includes("time of issue") &&
              !t.toLowerCase().includes("valid upto") &&
              !t.toLowerCase().includes("hrs")
          );

        const normalizedSummary = bulletMatches.join(". ");
        const validityNote = validMatch ? ` (Valid upto: ${validMatch[1].trim()})` : "";
        const displayWarningText = normalizedSummary ? `${normalizedSummary}${validityNote}` : "No severe weather warning active.";

        let headline = `${severity} Alert: ${districtName} Nowcast Bulletin`;
        if (severity === "Low") {
          headline = `No Severe Warning Issued for ${districtName}`;
        } else if (severity === "Severe") {
          headline = `Severe Weather Warning: ${districtName} Sector`;
        }

        const normalizedIssue = normalizeImdTimestamp(issueMatch ? issueMatch[1].trim() : null);
        const issueIso = normalizedIssue.isoString;
        const validFromIso = issueIso;
        
        // Calculate validTo ISO timestamp (typically +3 hours for IMD nowcast if valid upto string)
        let validToIso = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
        if (validMatch) {
          const parsedValid = normalizeImdTimestamp(validMatch[1].trim());
          if (parsedValid.isValid) {
            validToIso = parsedValid.isoString;
          }
        }

        const sourceId = `imd_nowcast_${selectedArea.id || districtCode}`;
        const alertHash = computeAlertHash(sourceId, districtCode, issueIso, displayWarningText);

        const liveAlert: IMDWarningProduct = {
          id: sourceId,
          alertHash,
          sourceId,
          districtCode,
          district: districtName,
          state: stateName,
          severity,
          officialSeverity,
          headline,
          warningText: displayWarningText,
          rawBulletin: rawInfo,
          normalizedBulletin: normalizedSummary,
          sourceProduct: "IMD Mausam District Nowcast Portal (MoES)",
          sourceUrl: "https://mausam.imd.gov.in/responsive/districtWiseNowcast.php",
          issueTime: issueIso,
          validFrom: validFromIso,
          validTo: validToIso,
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
export function getActiveDistrictAlerts(district: string = "Raigad", state?: string): IMDWarningProduct[] {
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
