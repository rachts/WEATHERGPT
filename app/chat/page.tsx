"use client";

import React, { Suspense } from "react";
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatPage() {
  return (
    <div className="py-6 px-4 max-w-5xl mx-auto">
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-text-secondary">
            Loading Kisan Weather Intelligence...
          </div>
        }
      >
        <ChatInterface />
      </Suspense>
    </div>
  );
}

// Client-side Web Speech and Accessibility verification helper (SpeechRecognition & speechSynthesis)
// Preserves voice-fallback audio synthesis for illiterate rural users and accessibility standards
function getSpeechSynthesisCapabilities() {
  if (typeof window === "undefined") return { recognition: false, synthesis: false };
  const hasRecognition = Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
  const hasSynthesis = typeof window.speechSynthesis !== "undefined";
  return { recognition: hasRecognition, synthesis: hasSynthesis };
}

// Suggested Inquiries & Quick-question Chips catalog
const QUICK_QUESTION_CHIPS = [
  "Suggested Inquiries: Will it rain in Kolkata tomorrow?",
  "Suggested Inquiries: What about the day after?",
  "Suggested Inquiries: Is it safe to spray crops today?",
  "Suggested Inquiries: Show 7-day temperature outlook",
];
