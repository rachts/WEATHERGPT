/**
 * Utility for robustly normalizing IMD / WFS update_time and issueTime values.
 * Handles ISO strings, Unix epoch seconds (e.g. 1726234800), Unix milliseconds (1726234800000),
 * and dates with timezone offsets, falling back to a tagged current time if invalid.
 */
export interface NormalizedTimestamp {
  isoString: string;
  date: Date;
  isFallback: boolean;
  isValid: boolean;
}

export function normalizeImdTimestamp(raw: any): NormalizedTimestamp {
  if (raw === null || raw === undefined || raw === "") {
    const now = new Date();
    return {
      isoString: now.toISOString(),
      date: now,
      isFallback: true,
      isValid: false,
    };
  }

  // Handle Date objects
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return {
      isoString: raw.toISOString(),
      date: raw,
      isFallback: false,
      isValid: true,
    };
  }

  // Handle numeric timestamps (Unix seconds vs Unix ms)
  // M13: Only treat as epoch when strictly digits of length 9 to 13 within plausible range
  if (typeof raw === "number" || (typeof raw === "string" && /^\d{9,13}$/.test(raw.trim()))) {
    const num = Number(raw);
    const ms = num < 1e11 ? num * 1000 : num;
    // Plausible epoch range: 1990-01-01 (631152000000) to 2100-01-01 (4102444800000)
    if (ms >= 631152000000 && ms <= 4102444800000) {
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return {
          isoString: d.toISOString(),
          date: d,
          isFallback: false,
          isValid: true,
        };
      }
    }
  }

  // Handle String dates (ISO, RFC, and IMD DD-MM-YYYY format)
  if (typeof raw === "string") {
    const cleanStr = raw.trim().replace(/^['"]|['"]$/g, "");

    // Check for DD-MM-YYYY or DD/MM/YYYY with optional time (standard IMD nowcast format in IST)
    const ddmmyyyyMatch = cleanStr.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (ddmmyyyyMatch) {
      const [, day, month, year, hours = "00", minutes = "00", seconds = "00"] = ddmmyyyyMatch;
      const isoCandidate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
      const d = new Date(isoCandidate);
      if (!isNaN(d.getTime())) {
        return {
          isoString: d.toISOString(),
          date: d,
          isFallback: false,
          isValid: true,
        };
      }
    }

    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return {
        isoString: d.toISOString(),
        date: d,
        isFallback: false,
        isValid: true,
      };
    }
  }

  // Fallback if parsing fails completely
  const now = new Date();
  return {
    isoString: now.toISOString(),
    date: now,
    isFallback: true,
    isValid: false,
  };
}
