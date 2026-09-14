"use client";

import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-4 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full border border-border bg-surface flex items-center justify-center mx-auto text-text-secondary">
        <span className="material-symbols-outlined text-[32px]">cloud_off</span>
      </div>
      <h1 className="text-xl font-medium text-text-primary">Page Not Found</h1>
      <p className="text-xs text-text-secondary leading-relaxed">
        The meteorological resource or bulletin you requested is unavailable or has moved.
      </p>
      <div className="pt-4">
        <Link
          href="/"
          className="inline-block px-4 py-2 border border-primary text-primary hover:bg-primary-light rounded-lg text-xs font-medium transition-colors"
        >
          Return to Weather Dashboard
        </Link>
      </div>
    </div>
  );
}
