"use client";

import { useEffect, useState } from "react";
import DashboardView from "@/components/DashboardView";
import OnboardingPage from "./onboarding/page";

export default function RootPage() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("weathergpt_onboarded");
      setIsOnboarded(stored === "true");
    }
  }, []);

  if (isOnboarded === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="top-loading-bar"></div>
      </div>
    );
  }

  if (!isOnboarded) {
    return <OnboardingPage />;
  }

  return <DashboardView />;
}
