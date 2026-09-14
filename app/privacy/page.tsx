import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="py-6 space-y-6 max-w-2xl mx-auto">
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <h1 className="text-2xl text-text-primary font-medium tracking-tight">Privacy Policy</h1>
        <Link href="/settings" className="text-xs text-primary hover:underline">
          ← Back to Settings
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-5 text-sm text-text-primary leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-medium text-text-primary">1. Overview & Project Mandate</h2>
          <p className="text-text-secondary text-xs">
            WeatherGPT is an open agricultural intelligence student prototype developed under Smart India
            Hackathon 2026 (Problem Statement 26068) using open data feeds published by the India
            Meteorological Department (IMD). It is an independent student prototype and not an official
            portal of the Ministry of Earth Sciences. We prioritize data minimization and farmer privacy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-text-primary">2. What Information We Collect & Why</h2>
          <ul className="text-xs text-text-secondary space-y-2 list-disc pl-5">
            <li>
              <strong>Geographical District:</strong> Processed solely to
              deliver hyperlocal agromet advisories, precipitation forecasts, and Doppler radar sweeps.
              GPS coordinates are processed on your device and are never sold, tracked, or shared with third parties.
            </li>
            <li>
              <strong>Preferred Language (Hindi, Tamil, or English):</strong> Stored locally on your
              device via browser storage to phrase weather advisories in your selected language.
            </li>
            <li>
              <strong>Conversational Queries:</strong> Processed in real time for meteorological intent
              resolution. We do not store queries tied to personally identifiable information.
            </li>
            <li>
              <strong>Voice Audio:</strong> Captured through your browser&apos;s on-device Web Speech API.
              Speech-to-text processing occurs directly on your smartphone; raw audio recordings are
              never transmitted to any speech cloud servers.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-text-primary">3. Deterministic Meteorological Data Integrity</h2>
          <p className="text-xs text-text-secondary">
            WeatherGPT operates a strict citation gate. All calculations are evaluated by a deterministic,
            rule-based agronomic query engine over official IMD open bulletins and surface observations.
            Live numerical values (temperature, rainfall, wind) and emergency warning text are strictly
            retrieved from verifiable meteorological feeds and never hallucinated.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-text-primary">4. Data Retention & Deletion</h2>
          <p className="text-xs text-text-secondary">
            You can purge all saved settings, cached forecasts, and conversational state at any time by
            clearing your browser&apos;s local cache or resetting data in the Settings menu.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-text-primary">5. Contact & Feedback</h2>
          <p className="text-xs text-text-secondary">
            For questions or feedback regarding this prototype, please open an issue on our public project repository:{" "}
            <a
              href="https://github.com/rachts/WEATHERGPT/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              github.com/rachts/WEATHERGPT
            </a>.
          </p>
        </section>
      </div>

      <footer className="text-xs text-text-secondary text-center">
        Last updated: September 2026 · WeatherGPT Open Data Student Prototype (SIH 2026)
      </footer>
    </div>
  );
}
