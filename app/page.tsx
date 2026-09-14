"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardView from "@/components/DashboardView";

export default function RootPage() {
  const router = useRouter();
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("weathergpt_onboarded");
      if (stored !== "true") {
        router.replace("/onboarding");
      } else {
        setIsOnboarded(true);
      }
    }
  }, [router]);

  if (!isOnboarded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="top-loading-bar"></div>
      </div>
    );
  }

  return <DashboardView />;
}
