"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { logger } from "@/lib/utils/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("Segment render error captured by ErrorBoundary", {
      error,
      context: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4 text-text-secondary">
        <span className="material-symbols-outlined text-[32px] text-amber-600">warning</span>
      </div>
      <h2 className="text-xl font-medium text-text-primary mb-2">Something went wrong</h2>
      <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
        A temporary error occurred while rendering this weather intelligence module. Your location settings and data cache are safe.
      </p>
      <div className="flex items-center space-x-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-4 py-2 border border-border text-text-primary hover:bg-surface rounded-lg text-xs font-medium transition-colors"
        >
          Return Home
        </Link>
      </div>
      {error.digest && (
        <span className="mt-6 text-[10px] text-text-secondary font-mono">
          Ref ID: {error.digest}
        </span>
      )}
    </div>
  );
}
