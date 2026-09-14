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
  if (typeof raw === "number" || (!isNaN(Number(raw)) && !String(raw).includes("-") && !String(raw).includes(":"))) {
    const num = Number(raw);
    const ms = num < 1e11 ? num * 1000 : num;
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

  // Handle ISO / RFC string dates
  if (typeof raw === "string") {
    const cleanStr = raw.trim().replace(/^['"]|['"]$/g, "");
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
