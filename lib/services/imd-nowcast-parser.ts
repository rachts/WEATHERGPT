// WeatherGPT — Resilient IMD Nowcast & Warning Parser (v2.0)
// Designed to gracefully handle inconsistent HTML markup, alternative DOM structures,
// and state/district disambiguation without single-point failure.

import { logger } from "@/lib/utils/logger";
import { normalizeImdTimestamp } from "@/lib/utils/time";

export interface ImdNowcastArea {
  title: string;
  id: string;
  color: string;
  info: string;
  balloonText?: string;
}

export interface ParsedAreaBulletin {
  severity: "Low" | "Moderate" | "High" | "Severe";
  officialSeverity: "Green" | "Yellow" | "Orange" | "Red";
  headline: string;
  warningText: string;
  normalizedBulletin: string;
  rawBulletin: string;
  issueIso: string;
  validFromIso: string;
  validToIso: string;
  validUntilEstimated: boolean;
}

export interface ParserHealthStatus {
  consecutiveFailures: number;
  lastSuccessTimestamp: number | null;
  lastFailureTimestamp: number | null;
  healthy: boolean;
  lastError: string | null;
}

// Module-scoped parser health registry
let consecutiveFailures = 0;
let lastSuccessTimestamp: number | null = null;
let lastFailureTimestamp: number | null = null;
let lastError: string | null = null;

export function getImdParserHealth(): ParserHealthStatus {
  return {
    consecutiveFailures,
    lastSuccessTimestamp,
    lastFailureTimestamp,
    healthy: consecutiveFailures < 3,
    lastError,
  };
}

export function resetImdParserHealthForTesting(): void {
  consecutiveFailures = 0;
  lastSuccessTimestamp = null;
  lastFailureTimestamp = null;
  lastError = null;
}

/**
 * Extracts the JSON areas array embedded within IMD Mausam districtWiseNowcast.php HTML.
 * Uses multiple fallback patterns in case variable naming or structure shifts.
 */
export function extractNowcastAreas(html: string): ImdNowcastArea[] {
  if (!html || typeof html !== "string") {
    recordFailure("Input HTML is empty or invalid type");
    return [];
  }

  try {
    // Pattern 1: standard "areas": [...] inside JS block
    const pattern1 = /\"areas\"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/;
    const match1 = html.match(pattern1);
    if (match1 && match1[1]) {
      const parsed = JSON.parse(match1[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        recordSuccess();
        return parsed;
      }
    }

    // Pattern 2: areas = [...] assignment
    const pattern2 = /(?:var|let|const)?\s*areas\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])/;
    const match2 = html.match(pattern2);
    if (match2 && match2[1]) {
      const parsed = JSON.parse(match2[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        recordSuccess();
        return parsed;
      }
    }

    // Pattern 3: loose JSON object containing areas key
    const pattern3 = /\{\s*\"?areas\"?\s*:\s*\[[\s\S]*?\]\s*\}/;
    const match3 = html.match(pattern3);
    if (match3 && match3[0]) {
      const parsed = JSON.parse(match3[0]);
      if (Array.isArray(parsed?.areas) && parsed.areas.length > 0) {
        recordSuccess();
        return parsed.areas;
      }
    }

    recordFailure("No recognizable areas JSON pattern found in IMD HTML");
    return [];
  } catch (err) {
    recordFailure(`JSON parse error on extracted areas: ${(err as Error).message}`);
    return [];
  }
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  lastSuccessTimestamp = Date.now();
  lastError = null;
}

function recordFailure(reason: string): void {
  consecutiveFailures++;
  lastFailureTimestamp = Date.now();
  lastError = reason;

  if (consecutiveFailures >= 3) {
    logger.warn("IMD Nowcast parser has encountered 3+ consecutive parse failures", {
      consecutiveFailures,
      lastError: reason,
      health: "DEGRADED",
    });
  }
}

/**
 * Resiliently parses issue time, validity time, severity, and text bullets from area info HTML.
 */
export function parseNowcastAreaInfo(
  rawInfo: string = "",
  areaColor: string = "",
  districtName: string = ""
): ParsedAreaBulletin {
  const color = (areaColor || "").toUpperCase();
  let severity: "Low" | "Moderate" | "High" | "Severe" = "Low";
  let officialSeverity: "Green" | "Yellow" | "Orange" | "Red" = "Green";

  if (color === "#FF0000" || color === "RED") {
    severity = "Severe";
    officialSeverity = "Red";
  } else if (color === "#FFA500" || color === "ORANGE") {
    severity = "High";
    officialSeverity = "Orange";
  } else if (color === "#FFFF00" || color === "YELLOW") {
    severity = "Moderate";
    officialSeverity = "Yellow";
  }

  // Issue time parsing with multiple markup variants:
  // 1. Time of issue</b>: <p>14-09-2026 12:00:00</p>
  // 2. <b>Time of issue:</b> 14-09-2026 12:00:00
  // 3. Time of issue\s*:\s*([^\n<]+)
  const issuePatterns = [
    /Time\s*of\s*issue(?:\s*:)?(?:\s*<\/b>)?\s*:?\s*(?:<p>)?\s*([^<\n]+)/i,
    /<b[^>]*>\s*Time\s*of\s*issue(?:\s*:)?\s*<\/b>\s*:?\s*([^<\n]+)/i,
    /Time\s*of\s*issue\s*:?\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4}\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/i,
    /Date\s*&\s*Time\s*of\s*issue\s*:?\s*([^<\n]+)/i,
  ];

  let rawIssueTime: string | null = null;
  for (const pattern of issuePatterns) {
    const match = rawInfo.match(pattern);
    if (match && match[1]?.trim()) {
      rawIssueTime = match[1].trim();
      break;
    }
  }

  const validPatterns = [
    /Valid\s*(?:up\s*to|upto|until|till)(?:\s*:)?(?:\s*<\/b>)?\s*:?\s*(?:<p>)?\s*([^<\n]+)/i,
    /<b[^>]*>\s*Valid\s*(?:up\s*to|upto|until|till)(?:\s*:)?\s*<\/b>\s*:?\s*([^<\n]+)/i,
    /Valid\s*(?:up\s*to|upto|until|till)\s*:?\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4}\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/i,
  ];

  let rawValidUpto: string | null = null;
  for (const pattern of validPatterns) {
    const match = rawInfo.match(pattern);
    if (match && match[1]?.trim()) {
      rawValidUpto = match[1].trim();
      break;
    }
  }

  // Extract clean bullet messages (excluding metadata lines)
  const paragraphMatches = Array.from(rawInfo.matchAll(/<p>([^<]+)<\/p>/gi))
    .map((m) => m[1].trim())
    .filter((t) => {
      const lower = t.toLowerCase();
      return (
        !lower.includes("time of issue") &&
        !lower.includes("valid upto") &&
        !lower.includes("valid up to") &&
        !lower.includes("valid until") &&
        !lower.includes("valid till") &&
        !lower.includes("district nowcast")
      );
    });

  // If no <p> tags, split by <br> or newlines
  const textBullets =
    paragraphMatches.length > 0
      ? paragraphMatches
      : rawInfo
          .replace(/<[^>]+>/g, "\n")
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => {
            const lower = s.toLowerCase();
            return (
              s.length > 3 &&
              !lower.includes("time of issue") &&
              !lower.includes("valid upto") &&
              !lower.includes("valid up to") &&
              !lower.includes("valid until")
            );
          });

  const normalizedSummary = textBullets.join(". ").replace(/\s*\.\s*\./g, ".");
  const validityNote = rawValidUpto ? ` (Valid upto: ${rawValidUpto})` : "";
  const displayWarningText = normalizedSummary
    ? `${normalizedSummary}${validityNote}`
    : "No severe weather warning active.";

  let headline = `${severity} Alert: ${districtName || "District"} Nowcast Bulletin`;
  if (severity === "Low") {
    headline = `No Severe Warning Issued for ${districtName || "District"}`;
  } else if (severity === "Severe") {
    headline = `Severe Weather Warning: ${districtName || "District"} Sector`;
  }

  const normalizedIssue = normalizeImdTimestamp(rawIssueTime);
  const issueIso = normalizedIssue.isoString;
  const validFromIso = issueIso;

  let validToIso: string;
  let validUntilEstimated = false;

  if (rawValidUpto) {
    const parsedValid = normalizeImdTimestamp(rawValidUpto);
    if (parsedValid.isValid) {
      validToIso = parsedValid.isoString;
    } else {
      // Failed to parse "valid upto" -> fallback to issue + 3h and mark estimated
      validToIso = new Date(new Date(issueIso).getTime() + 3 * 3600 * 1000).toISOString();
      validUntilEstimated = true;
    }
  } else {
    // Unspecified valid upto -> default +3h and mark estimated (M3)
    validToIso = new Date(new Date(issueIso).getTime() + 3 * 3600 * 1000).toISOString();
    validUntilEstimated = true;
  }

  return {
    severity,
    officialSeverity,
    headline,
    warningText: displayWarningText,
    normalizedBulletin: normalizedSummary || displayWarningText,
    rawBulletin: rawInfo,
    issueIso,
    validFromIso,
    validToIso,
    validUntilEstimated,
  };
}

/**
 * Scored district resolution (exact > prefix > token-boundary > contains)
 * Disambiguates cross-state collisions using balloonText, info, and id (M4).
 */
export function findBestMatchingNowcastArea(
  areas: ImdNowcastArea[],
  districtName: string,
  stateName?: string
): ImdNowcastArea | null {
  if (!areas || areas.length === 0 || !districtName) return null;

  const cleanDistrict = districtName.toUpperCase().replace(/\s+DISTRICT\b/i, "").trim();
  const cleanState = stateName ? stateName.toUpperCase().trim() : "";

  interface ScoredCandidate {
    area: ImdNowcastArea;
    score: number;
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (const area of areas) {
    const titleUpper = (area.title || "").toUpperCase().trim();
    let score = 0;

    if (titleUpper === cleanDistrict) {
      score = 100; // Exact match
    } else if (titleUpper.startsWith(cleanDistrict + " ") || titleUpper.endsWith(" " + cleanDistrict)) {
      score = 80; // Word prefix / suffix
    } else if (titleUpper.startsWith(cleanDistrict)) {
      score = 60; // Strict prefix
    } else if (titleUpper.includes(cleanDistrict)) {
      score = 40; // Substring
    } else if (cleanDistrict.includes(titleUpper) && titleUpper.length >= 4) {
      score = 30; // Reverse substring
    }

    if (score > 0) {
      // State verification boost or tie-breaker
      if (cleanState) {
        const infoUpper = (area.info || "").toUpperCase();
        const balloonUpper = (area.balloonText || "").toUpperCase();
        const idUpper = (area.id || "").toUpperCase();

        if (
          infoUpper.includes(cleanState) ||
          balloonUpper.includes(cleanState) ||
          idUpper.includes(cleanState)
        ) {
          score += 50; // Strong state affinity
        }
      }

      scoredCandidates.push({ area, score });
    }
  }

  if (scoredCandidates.length === 0) return null;

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0].area;
}
