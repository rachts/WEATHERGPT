"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LocationModal from "@/components/LocationModal";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import { useTranslation } from "@/lib/i18n/context";

export default function Navigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, lang, setLanguage } = useTranslation();
  const [isOnline, setIsOnline] = useState(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [activeLocation, setActiveLocationState] = useState({
    district: "Raigad",
    state: "Maharashtra",
  });

  useEffect(() => {
    // Initialize active location
    setActiveLocationState(getActiveLocation());

    const handleLocationChange = (e: Event) => {
      const custom = e as CustomEvent<{ district: string; state: string }>;
      if (custom.detail) {
        setActiveLocationState({
          district: custom.detail.district,
          state: custom.detail.state,
        });
      } else {
        setActiveLocationState(getActiveLocation());
      }
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);

    // Register Service Worker for PWA in production only (avoids dev chunk collisions & HMR errors)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker
          .register("/sw.js")
          .catch(() => {});
      } else {
        // In development, ensure any stale production SW is unregistered and caches cleared
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().catch(() => {});
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
            }
          });
        }
      }
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const navItems = [
    { href: "/", label: t.nav.home, icon: "home" },
    { href: "/radar", label: t.nav.radar, icon: "radar" },
    { href: "/chat", label: t.nav.chat, icon: "chat" },
    { href: "/forecast", label: t.nav.forecast, icon: "calendar_today" },
    { href: "/alerts", label: t.nav.alerts, icon: "warning" },
    { href: "/settings", label: t.nav.settings, icon: "settings" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Top Header (Mobile & Desktop) */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-40 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Link href="/" className="flex items-center space-x-2 text-primary font-medium text-lg tracking-tight">
            <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
            <span>{t.nav.appTitle}</span>
          </Link>
          <button
            id="nav-location-button"
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center space-x-1 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-primary px-2 py-0.5 rounded bg-bg transition-colors cursor-pointer"
            title={t.nav.changeDistrict}
          >
            <span className="material-symbols-outlined text-[13px] text-primary">location_on</span>
            <span className="max-w-[100px] sm:max-w-none truncate">{activeLocation.district}</span>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors duration-150 ${
                  isActive
                    ? "text-primary border-b-2 border-primary pb-1"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Header Quick Language Switcher */}
          <div
            id="header-lang-switch"
            className="flex items-center border border-border rounded-lg p-0.5 bg-bg text-xs"
            role="group"
            aria-label="Language selector"
          >
            <button
              id="lang-btn-hi"
              type="button"
              aria-pressed={lang === "hi-IN"}
              onClick={() => setLanguage("hi-IN")}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                lang === "hi-IN"
                  ? "bg-primary text-white font-medium shadow-none"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="हिन्दी (Hindi)"
            >
              हिन्दी
            </button>
            <button
              id="lang-btn-en"
              type="button"
              aria-pressed={lang === "en-IN"}
              onClick={() => setLanguage("en-IN")}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                lang === "en-IN"
                  ? "bg-primary text-white font-medium shadow-none"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="English"
            >
              EN
            </button>
            <button
              id="lang-btn-ta"
              type="button"
              aria-pressed={lang === "ta-IN"}
              onClick={() => setLanguage("ta-IN")}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                lang === "ta-IN"
                  ? "bg-primary text-white font-medium shadow-none"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="தமிழ் (Tamil)"
            >
              தமிழ்
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-text-secondary">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-primary" : "bg-text-secondary"
              }`}
            ></span>
            <span className="hidden lg:inline">{isOnline ? t.nav.imdLive : t.nav.offlineCache}</span>
          </div>
          <Link
            href="/settings"
            className="text-text-secondary hover:text-text-primary p-1"
            title={t.nav.settings}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-14 pb-20 md:pb-8 max-w-3xl w-full mx-auto px-4 sm:px-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (Fixed at bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-40 flex items-center justify-around px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs transition-colors duration-150 ${
                isActive ? "text-primary font-medium" : "text-text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
