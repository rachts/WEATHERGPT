"use client";

import React, { useEffect } from "react";
import { logger } from "@/lib/utils/logger";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logger.error("Root layout global error captured", {
      error,
      context: { digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F7F4] text-[#1A2E1A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-xl border border-[#E0E5DF] shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#F5F7F4] border border-[#E0E5DF] flex items-center justify-center mx-auto mb-4 text-[#D97706]">
            ⚠️
          </div>
          <h1 className="text-xl font-medium text-[#1A2E1A] mb-2">Critical Application Error</h1>
          <p className="text-sm text-[#5C6B5C] mb-6 leading-relaxed">
            The application experienced an unexpected layout error. We apologize for the interruption.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 bg-[#2D5016] text-white hover:bg-[#233F11] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Reload Application
          </button>
          {error.digest && (
            <div className="mt-4 text-[10px] text-[#8C9B8C] font-mono">
              Error Digest: {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
