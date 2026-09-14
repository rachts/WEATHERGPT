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

export default function ChatInterface() {
  const { t, lang } = useTranslation();
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [input, setInput] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
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

  useEffect(() => {
    setActiveLoc(getActiveLocation());
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

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
                    <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-strong:text-primary">
                      <ReactMarkdown>{messageText}</ReactMarkdown>
                    </div>
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
