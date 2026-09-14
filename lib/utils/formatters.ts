// WeatherGPT — Canonical Formatters Utility (SIH 2026, PS 26068)
// Standardizes date, time, and meteorological unit formatting across the application.

/**
 * Format an ISO date string into Indian Standard Time (IST) 2-digit hour:minute.
 * Falls back gracefully to default time if unparseable or empty.
 */
export function formatISTTime(isoDateString?: string, fallback: string = "14:30"): string {
  if (!isoDateString) return fallback;
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return fallback;
  }
}

/**
 * Format an ISO date string into Indian Standard Date (e.g. "Sep 14").
 */
export function formatISTDate(isoDateString?: string): string {
  if (!isoDateString) return "";
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "";
  }
}
