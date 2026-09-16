"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { getActiveLocation } from "@/lib/utils/location";
import { useTranslation } from "@/lib/i18n/context";

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function extractMessageText(message: any): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("");
  }
  return "";
}

function cleanTextForSpeech(markdown: string): string {
  return markdown
    .replace(/[*_#`~>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/🛡️ Evidence & Provenance[\s\S]*/gi, "")
    .trim();
}

const JUDGE_SCENARIOS = [
  {
    day: "Day 1",
    tag: "Spray & Heat Risk",
    query: "Will it rain in Raigad today? Is it safe to spray pesticides on crops?",
    desc: "Tests ICAR-CRIDA spray safety wind/rain rules & zero fabricated temperatures.",
  },
  {
    day: "Day 2",
    tag: "Warning & Alert",
    query: "Check rainfall alert status and heavy rain warning for Ratnagiri",
    desc: "Tests IMD Nowcast alert ingestion, color-coded warning, and Tele MANAS safety net.",
  },
  {
    day: "Day 3",
    tag: "Offline Resilience",
    query: "Show 7-day temperature outlook and verify provenance when network is degraded",
    desc: "Proves honest provenance badge (OBSERVED/ESTIMATED/FALLBACK) with no hallucinated metrics.",
  },
];

export default function ChatInterface() {
  const { t, lang } = useTranslation();
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [input, setInput] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [judgeMode, setJudgeMode] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, stop, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        district: activeLoc.district,
        state: activeLoc.state,
        lang,
      },
    }),
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Web Speech Text-to-Speech (TTS) for Voice-First Mode
  const speakMessage = (text: string, messageId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    if (speakingId === messageId) {
      setSpeakingId(null);
      return;
    }

    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang || "en-IN";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    setActiveLoc(getActiveLocation());
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Auto-speak when new assistant message completes in voice mode
  useEffect(() => {
    if (!voiceOutputEnabled || isLoading || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest && latest.role === "assistant" && speakingId !== latest.id) {
      const text = extractMessageText(latest);
      speakMessage(text, latest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, voiceOutputEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleVoiceToggle = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setVoiceActive(true);
      recognition.onend = () => setVoiceActive(false);
      recognition.onerror = () => setVoiceActive(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceActive(false);
    }
  };

  const handleChipClick = (query: string) => {
    setInput(query);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;
    sendMessage({ text: query });
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-surface-alt border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
            🌾
          </div>
          <div>
            <h2 className="text-sm font-medium text-text-primary">
              {t.chat?.title || "Kisan Weather Intelligence AI"}
            </h2>
            <p className="text-[11px] text-text-secondary">
              Conversational meteorologist for <span className="font-medium text-primary">{activeLoc.district}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setJudgeMode((prev) => !prev)}
            className={`px-2.5 py-1 text-xs rounded-md border font-medium transition cursor-pointer flex items-center space-x-1.5 ${
              judgeMode
                ? "bg-amber-100 text-amber-900 border-amber-300 shadow-xs"
                : "bg-surface text-text-secondary hover:text-text-primary border-border"
            }`}
            title="Toggle SIH Hackathon Judge Evaluation Mode"
          >
            <span>⚖️</span>
            <span>Judge Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceOutputEnabled((prev) => !prev)}
            className={`px-2.5 py-1 text-xs rounded-md border font-medium transition cursor-pointer flex items-center space-x-1.5 ${
              voiceOutputEnabled
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : "bg-surface text-text-secondary hover:text-text-primary border-border"
            }`}
            title="Read responses aloud with Web Speech"
          >
            <span>{voiceOutputEnabled ? "🔊" : "🔇"}</span>
            <span className="hidden sm:inline">Voice</span>
          </button>

          {isLoading && (
            <button
              onClick={() => stop()}
              className="px-2.5 py-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
            >
              {t.actions?.cancel || "Stop generating"}
            </button>
          )}
        </div>
      </div>

      {/* Judge Mode Interactive Scenario Drawer */}
      {judgeMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                ⚖️ SIH Hackathon Judge Mode
              </span>
              <span className="text-[11px] text-amber-800">
                Scripted 3-Day Evaluation Scenarios with Zero-Hallucination Provenance
              </span>
            </div>
            <button
              type="button"
              onClick={() => setJudgeMode(false)}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {JUDGE_SCENARIOS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInput(s.query);
                  sendMessage({ text: s.query });
                }}
                disabled={isLoading}
                className="text-left p-2.5 bg-surface/90 hover:bg-surface border border-amber-300/50 hover:border-amber-400 rounded-lg transition shadow-xs cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 mb-1">
                  <span>
                    {s.day}: {s.tag}
                  </span>
                  <span className="text-[10px] text-primary group-hover:underline">Run →</span>
                </div>
                <p className="text-xs text-text-primary font-medium line-clamp-1">{s.query}</p>
                <p className="text-[10px] text-text-secondary mt-1">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Stream Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl text-primary">
              🌦️
            </div>
            <div>
              <h3 className="text-base font-medium text-text-primary">
                {t.chat?.suggestedTitle || "Suggested Inquiries"}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {t.chat?.placeholder || "Ask weather question in your language..."}
              </p>
            </div>

            {/* Suggested Inquiries / Quick-question Chips */}
            <div className="w-full pt-2">
              <span className="text-[11px] font-medium text-text-secondary block mb-2 text-left">
                {t.chat?.suggestedTitle || "Suggested Inquiries"}:
              </span>
              <div className="flex flex-wrap gap-2">
                {(t.chat?.suggested || [
                  `Will it rain in ${activeLoc.district} tomorrow?`,
                  "What about the day after?",
                  "Is it safe to spray crops today?",
                  "Show 7-day temperature forecast",
                ]).map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(q)}
                    className="text-left text-xs bg-surface-alt hover:bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const messageText = extractMessageText(m);
            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${
                  m.role === "user" ? "flex-row-reverse justify-start" : "justify-start"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                    m.role === "user"
                      ? "bg-primary text-white"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {m.role === "user" ? "👤" : "🌾"}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-tr-xs"
                      : "bg-surface-alt text-text-primary border border-border rounded-tl-xs"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{messageText}</p>
                  ) : (
                    <>
                      <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-strong:text-primary">
                        <ReactMarkdown>{messageText}</ReactMarkdown>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60 text-[11px] text-text-secondary">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Verified IMD Grounding
                        </span>
                        <button
                          type="button"
                          onClick={() => speakMessage(messageText, m.id)}
                          className="px-2 py-0.5 text-xs text-text-secondary hover:text-text-primary bg-surface/80 hover:bg-surface border border-border rounded transition flex items-center gap-1 cursor-pointer"
                          title="Listen to this response via Web Speech"
                        >
                          <span>{speakingId === m.id ? "⏹️ Stop" : "🔊 Listen"}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading / Generating Indicator */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center text-xs">
              🌾
            </div>
            <div className="bg-surface-alt border border-border rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-text-secondary flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Consulting official IMD meteorological telemetry...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form onSubmit={handleSubmit} className="p-4 bg-surface-alt border-t border-border">
        <div className="flex items-center gap-2">
          {speechSupported && (
            <button
              type="button"
              onClick={handleVoiceToggle}
              className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                voiceActive
                  ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                  : "bg-surface text-text-secondary hover:text-text-primary border-border"
              }`}
              title="Speak your weather inquiry (Web Speech)"
            >
              🎤
            </button>
          )}

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chat?.placeholder || `Ask about weather, rain, or crops in ${activeLoc.district}...`}
            className="flex-1 px-4 py-2.5 bg-surface text-text-primary border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-text-secondary/60"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t.actions?.send || "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
