"use client";

import React from "react";
import { DataQuality, Provider } from "@/lib/types/provenance";

export type BadgeState =
  | "LIVE"
  | "CACHED"
  | "FALLBACK"
  | "DEMO"
  | "STALE"
  | "OFFLINE"
  | "UNAVAILABLE";

interface DataStatusBadgeProps {
  status?: BadgeState | DataQuality;
  provider?: Provider;
  providerName?: string;
  observedAt?: string | null;
  className?: string;
}

export default function DataStatusBadge({
  status = "LIVE",
  provider = "IMD",
  providerName,
  observedAt,
  className = "",
}: DataStatusBadgeProps) {
  // Normalize status
  let normStatus: BadgeState = "LIVE";
  const s = String(status).toUpperCase();
  if (s === "OBSERVED" || s === "LIVE") normStatus = "LIVE";
  else if (s === "CACHED") normStatus = "CACHED";
  else if (s === "FALLBACK") normStatus = "FALLBACK";
  else if (s === "DEMO") normStatus = "DEMO";
  else if (s === "STALE") normStatus = "STALE";
  else if (s === "OFFLINE") normStatus = "OFFLINE";
  else if (s === "UNAVAILABLE") normStatus = "UNAVAILABLE";

  const config = {
    LIVE: {
      label: `LIVE — ${providerName || (provider === "IMD" ? "IMD MoES" : provider)}`,
      badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
      dotClass: "bg-emerald-500 animate-pulse",
    },
    FALLBACK: {
      label: `FALLBACK — ${providerName || "Open-Meteo"}`,
      badgeClass: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
      dotClass: "bg-blue-500",
    },
    CACHED: {
      label: `CACHED — ${providerName || (provider === "IMD" ? "IMD" : provider)}`,
      badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
      dotClass: "bg-amber-500",
    },
    DEMO: {
      label: "DEMO DATA",
      badgeClass: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
      dotClass: "bg-purple-500",
    },
    STALE: {
      label: "STALE TELEMETRY",
      badgeClass: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
      dotClass: "bg-orange-500",
    },
    OFFLINE: {
      label: "OFFLINE SNAPSHOT",
      badgeClass: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-300 dark:border-zinc-500/30",
      dotClass: "bg-zinc-500",
    },
    UNAVAILABLE: {
      label: "UNAVAILABLE",
      badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
      dotClass: "bg-rose-500",
    },
  }[normStatus];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border shadow-xs transition-colors ${config.badgeClass} ${className}`}
      title={observedAt ? `Observed / Issued at: ${observedAt}` : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}
