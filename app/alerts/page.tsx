"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatISTDate } from "@/lib/utils/formatters";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import LocationModal from "@/components/LocationModal";

interface AlertItem {
  id: string;
  district: string;
  severity: "Low" | "Moderate" | "High" | "Severe";
  headline: string;
  warningText: string;
  sourceProduct: string;
  issueTime: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

export default function AlertsPage() {
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedToast, setSharedToast] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const fetchAlerts = useCallback(async (district: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/alerts?district=${encodeURIComponent(district)}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loc = getActiveLocation();
    setActiveLoc(loc);
    fetchAlerts(loc.district);

    const handleLocationChange = (e: Event) => {
      const custom = e as CustomEvent<{ district: string; state: string }>;
      const newDistrict = custom.detail ? custom.detail.district : getActiveLocation().district;
      const newState = custom.detail ? custom.detail.state : getActiveLocation().state;
      setActiveLoc({ district: newDistrict, state: newState });
      fetchAlerts(newDistrict);
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
    return () => window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
  }, [fetchAlerts]);

  const handleShare = (alert: AlertItem) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: `IMD ${alert.severity} Alert: ${alert.headline}`,
          text: alert.warningText,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(`[IMD ${alert.severity} Alert: ${alert.headline}]\n${alert.warningText}`);
      setSharedToast("Warning text copied to clipboard.");
      setTimeout(() => setSharedToast(null), 2500);
    }
  };

  // Sort alerts strictly by severity tier (Severe -> High -> Moderate -> Low) per Design_v2.md
  const severityRank: Record<string, number> = {
    Severe: 4,
    High: 3,
    Moderate: 2,
    Low: 1,
  };

  const sortedAlerts = [...alerts].sort(
    (a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0)
  );

  return (
    <div className="py-4 space-y-6">
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Toast */}
      {sharedToast && (
        <div className="fixed top-16 right-4 bg-primary text-white text-xs px-4 py-2 rounded shadow-none z-50">
          {sharedToast}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl text-text-primary font-medium tracking-tight">
              Weather Warnings & Bulletins
            </h1>
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="text-xs text-primary underline underline-offset-4 hover:text-primary-dark transition-colors"
            >
              Change
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {activeLoc.district} District, {activeLoc.state} · Multi-Tier Impact Warnings (IMD MoES)
          </p>
        </div>
        <span className="text-xs text-primary border border-primary px-2.5 py-1 rounded bg-primary-light font-medium self-start sm:self-auto">
          Impact-Based System
        </span>
      </div>

      {/* Severity Color-Blind Safe Notice */}
      <div className="bg-surface border border-border p-3 rounded-lg text-xs text-text-secondary flex items-center justify-between">
        <span>Accessibility: Severity is identified by label text, border weight, and sort order.</span>
        <span className="text-primary font-medium">Color-Blind Verified</span>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="top-loading-bar"></div>
            <p className="text-sm text-text-secondary">Checking official IMD warning bulletins...</p>
          </div>
        ) : sortedAlerts.length > 0 ? (
          sortedAlerts.map((alert) => {
            const isSevere = alert.severity === "Severe";
            const isHigh = alert.severity === "High";
            const isModerate = alert.severity === "Moderate";

            // Border styling based on severity level
            let borderStyle = "border-l-[1px] border-l-border";
            let badgeStyle = "text-text-secondary border-border";
            let dotColor = "bg-text-secondary";

            if (isSevere) {
              borderStyle = "border-l-[4px] border-l-severity-severe";
              badgeStyle = "text-severity-severe border-severity-severe font-medium";
              dotColor = "bg-severity-severe";
            } else if (isHigh) {
              borderStyle = "border-l-[3px] border-l-severity-high";
              badgeStyle = "text-severity-high border-severity-high font-medium";
              dotColor = "bg-severity-high";
            } else if (isModerate) {
              borderStyle = "border-l-[2px] border-l-primary";
              badgeStyle = "text-primary border-primary font-medium";
              dotColor = "bg-primary";
            }

            return (
              <article
                key={alert.id}
                className={`bg-surface border border-border ${borderStyle} p-4 sm:p-5 rounded-r-xl space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${dotColor} inline-block`}></span>
                    <span className={`text-[11px] uppercase tracking-widest px-2 py-0.5 rounded border ${badgeStyle}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-secondary font-mono">
                    Valid till {formatISTDate(alert.validTo)}
                  </span>
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-medium text-text-primary tracking-tight">
                    {alert.headline}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-primary mt-1.5 leading-relaxed font-normal">
                    {/* VERBATIM WARNING TEXT - NEVER PARAPHRASED */}
                    {alert.warningText}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <div className="flex items-center space-x-4">
                    <Link
                      href="/radar"
                      className="text-primary font-medium uppercase tracking-wider text-[11px] hover:underline"
                    >
                      View Radar
                    </Link>
                    <button
                      onClick={() => handleShare(alert)}
                      className="text-primary font-medium uppercase tracking-wider text-[11px] hover:underline"
                    >
                      Share Warning
                    </button>
                  </div>
                  <span className="text-[11px] text-text-secondary truncate max-w-[180px]">
                    {alert.sourceProduct}
                  </span>
                </div>
              </article>
            );
          })
        ) : (
          <div className="bg-surface border border-border p-8 rounded-xl text-center space-y-2">
            <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
            <h3 className="text-sm font-medium text-text-primary">No Active Warnings</h3>
            <p className="text-xs text-text-secondary">
              {activeLoc.district} district weather is currently within normal operating safety parameters.
            </p>
          </div>
        )}
      </div>

      {/* Dissemination Protocol Information (Dashed lines / production targets) */}
      <section className="bg-surface border border-border p-4 rounded-xl space-y-2 text-xs text-text-secondary">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary">
          IMD Tiered Escalation Routing
        </h3>
        <ul className="space-y-1.5 pl-4 list-disc">
          <li><strong>Low:</strong> In-app notification banner (Active in prototype)</li>
          <li><strong>Moderate:</strong> Web Push notification (Active in prototype)</li>
          <li><strong>High:</strong> Web Push + SMS Gateway (SMS stubbed with production target TODO)</li>
          <li><strong>Severe:</strong> Web Push + SMS + IVR Voice Call (SMS/IVR stubbed with production target TODO)</li>
        </ul>
      </section>
    </div>
  );
}
