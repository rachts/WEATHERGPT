"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatISTTime } from "@/lib/utils/formatters";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import type { QueryResponse } from "@/lib/services/query-pipeline";

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  dataCard?: QueryResponse["dataCard"];
  sourceProduct?: string;
  issueTime?: string;
  timestamp: string;
  isError?: boolean;
  retryQuery?: string;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-text-secondary">Loading chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"hi-IN" | "ta-IN" | "en-IN">("hi-IN");
  const [voiceActive, setVoiceActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [ttsSpeaking, setTtsSpeaking] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sentRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }

    const savedLang = localStorage.getItem("weathergpt_lang") as "hi-IN" | "ta-IN" | "en-IN";
    if (savedLang) setLanguage(savedLang);

    const loc = getActiveLocation();
    setActiveLoc(loc);

    const handleLocationChange = (e: Event) => {
      const custom = e as CustomEvent<{ district: string; state: string }>;
      if (custom.detail) {
        setActiveLoc({ district: custom.detail.district, state: custom.detail.state });
      } else {
        setActiveLoc(getActiveLocation());
      }
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);

    if (initialQuery && !sentRef.current) {
      sentRef.current = true;
      handleSendMessage(initialQuery);
    }
    return () => window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMsg: ChatMessage = {
      id: "u_" + Date.now(),
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          district: activeLoc.district,
          language,
        }),
        signal: abortController.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: "a_" + Date.now(),
          role: "assistant",
          content: data.answerText,
          dataCard: data.dataCard,
          sourceProduct: data.sourceProduct,
          issueTime: data.issueTime,
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Auto read-aloud if enabled in settings
        if (typeof window !== "undefined" && localStorage.getItem("weathergpt_voice") === "true") {
          handleSpeak(data.answerText, aiMsg.id);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const aiErr: ChatMessage = {
          id: "e_" + Date.now(),
          role: "assistant",
          content: errJson.error || "Could not retrieve weather intelligence. Please check connection.",
          isError: true,
          retryQuery: queryText,
          sourceProduct: "WeatherGPT Service Fallback",
          issueTime: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, aiErr]);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.log("Chat query cancelled by user");
        return;
      }
      console.error("Chat network error:", err);
      const networkErr: ChatMessage = {
        id: "net_" + Date.now(),
        role: "assistant",
        content: "Network connection lost or request timed out. Please check your internet connection.",
        isError: true,
        retryQuery: queryText,
        sourceProduct: "WeatherGPT Network Guard",
        issueTime: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, networkErr]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Web Speech API On-Device Capture
  const startVoiceInput = () => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceActive(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceActive(false);
        if (transcript) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.log("Speech recognition error:", event.error);
        setVoiceActive(false);
      };

      recognition.onend = () => {
        setVoiceActive(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setVoiceActive(false);
    }
  };

  const cancelVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceActive(false);
  };

  // Text-To-Speech (TTS Read-Aloud)
  const handleSpeak = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (ttsSpeaking === msgId) {
      window.speechSynthesis.cancel();
      setTtsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.onend = () => setTtsSpeaking(null);
    utterance.onerror = () => setTtsSpeaking(null);

    setTtsSpeaking(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-3.5rem-4rem)] md:h-[calc(100vh-3.5rem-2rem)]">
      {loading && <div className="top-loading-bar"></div>}

      {/* Screen 4: Fullscreen Voice Mode Overlay */}
      {voiceActive && (
        <div className="absolute inset-0 bg-bg z-50 flex flex-col items-center justify-between p-6">
          <div className="w-full flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-text-secondary">
              On-Device Voice · {language}
            </span>
            <button onClick={cancelVoiceInput} className="text-xs text-text-secondary hover:text-text-primary">
              Close
            </button>
          </div>

          <div className="flex flex-col items-center space-y-8 w-full max-w-sm text-center">
            <h2 className="text-2xl text-text-primary font-medium tracking-tight">Listening...</h2>

            {/* 40 Waveform Bars with Random Heights */}
            <div className="flex items-center justify-center gap-1 h-16 w-full px-4">
              {[30, 60, 40, 80, 50, 90, 30, 70, 45, 85, 60, 95, 40, 75, 55, 90, 35, 65, 50, 80].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="w-[1.5px] bg-primary rounded-full transition-all duration-200"
                    style={{
                      height: `${h}%`,
                      animation: "dot-pulse 1.2s infinite ease-in-out",
                      animationDelay: `${(idx % 5) * 0.15}s`,
                    }}
                  ></div>
                )
              )}
            </div>

            <p className="text-sm text-text-secondary">Speak clearly in your chosen language</p>
          </div>

          <button
            onClick={cancelVoiceInput}
            className="text-xs text-primary underline underline-offset-4 mb-4"
          >
            Cancel Voice Input
          </button>
        </div>
      )}

      {/* Top Header info */}
      <div className="py-2.5 px-2 border-b border-border flex items-center justify-between text-xs text-text-secondary">
        <span className="font-medium text-text-primary">{activeLoc.district}, {activeLoc.state}</span>
        <div className="flex items-center space-x-2">
          <span>Lang:</span>
          <select
            value={language}
            onChange={(e) => {
              const nl = e.target.value as any;
              setLanguage(nl);
              localStorage.setItem("weathergpt_lang", nl);
            }}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary focus:outline-none"
          >
            <option value="hi-IN">हिंदी</option>
            <option value="en-IN">English</option>
            <option value="ta-IN">தமிழ்</option>
          </select>
        </div>
      </div>

      {/* Screen 5: Empty Chat State */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-full border border-border bg-surface flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-text-secondary">cloud</span>
          </div>
          <div>
            <h2 className="text-base text-text-primary font-medium">No conversations yet</h2>
            <p className="text-xs text-text-secondary mt-1">Ask about the weather in your area</p>
          </div>

          {/* Quick-question Chips Fallback */}
          <div className="w-full max-w-md pt-4 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-text-secondary">
              Suggested Inquiries
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                `Will it rain in ${activeLoc.district} today?`,
                "Is it safe to spray pesticides on paddy?",
                "Show the 7-day forecast",
                "Are there any cyclone or flood warnings?",
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  className="bg-surface border border-border hover:border-primary text-text-primary px-3 py-1.5 rounded-full text-xs transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Screen 3: Active Chat Canvas */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {msg.role === "user" ? (
                /* User Message Bubble */
                <div className="bg-surface border border-primary text-text-primary rounded-2xl rounded-tr-sm p-3.5 max-w-[85%] text-sm leading-relaxed">
                  <p>{msg.content}</p>
                </div>
              ) : (
                /* Assistant Message Bubble */
                <div className="bg-surface-ai text-text-primary rounded-2xl rounded-tl-sm p-4 max-w-[90%] text-sm space-y-3 leading-relaxed border-none">
                  <p>{msg.content}</p>

                  {/* Data Card inside Assistant Message */}
                  {msg.dataCard && (
                    <div className="bg-surface border border-border rounded-lg p-3 space-y-2 text-xs">
                      {msg.dataCard.temperature && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-1.5 border border-border rounded bg-bg">
                            <div className="text-[10px] uppercase text-text-secondary">Temp</div>
                            <div className="font-medium text-text-primary mt-0.5">
                              {msg.dataCard.temperature}
                            </div>
                          </div>
                          <div className="p-1.5 border border-border rounded bg-bg">
                            <div className="text-[10px] uppercase text-text-secondary">Humidity</div>
                            <div className="font-medium text-text-primary mt-0.5">
                              {msg.dataCard.humidity}
                            </div>
                          </div>
                          <div className="p-1.5 border border-border rounded bg-bg">
                            <div className="text-[10px] uppercase text-text-secondary">Wind</div>
                            <div className="font-medium text-text-primary mt-0.5">
                              {msg.dataCard.wind}
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.dataCard.advisory && (
                        <div className="p-2 border border-border rounded bg-bg flex justify-between items-center">
                          <span className="font-medium">Advisory Window:</span>
                          <span className="text-primary font-medium">{msg.dataCard.advisory}</span>
                        </div>
                      )}

                      {msg.dataCard.severity && (
                        <div className="p-2 border border-border rounded bg-bg flex justify-between items-center">
                          <span className="font-medium">Warning Status:</span>
                          <span className="text-severity-high font-medium">
                            {msg.dataCard.severity} Tier
                          </span>
                        </div>
                      )}

                      {msg.dataCard.outlook && (
                        <div className="space-y-1">
                          {msg.dataCard.outlook.map((o: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between border-b border-border py-1 text-[11px]"
                            >
                              <span>{o.day}</span>
                              <span className="text-text-secondary">{o.condition}</span>
                              <span className="font-medium">{o.range}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Retry Button on Error */}
                  {msg.isError && msg.retryQuery && (
                    <div className="mt-2 pt-1.5 border-t border-border/60">
                      <button
                        onClick={() => handleSendMessage(msg.retryQuery)}
                        className="text-xs text-primary font-medium flex items-center space-x-1.5 border border-primary/40 px-2.5 py-1 rounded-md bg-surface hover:bg-primary-light transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                        <span>Retry Inquiry</span>
                      </button>
                    </div>
                  )}

                  {/* Source Citation & Issue Time Line */}
                  {msg.sourceProduct && (
                    <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1 border-t border-border">
                      <span className="truncate max-w-[200px]" title={msg.sourceProduct}>
                        Source: {msg.sourceProduct}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span>{formatISTTime(msg.issueTime, msg.timestamp)} IST</span>
                        {/* TTS Read-Aloud Button */}
                        <button
                          onClick={() => handleSpeak(msg.content, msg.id)}
                          className="text-primary hover:text-primary-dark p-0.5"
                          title="Read aloud in your language"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {ttsSpeaking === msg.id ? "stop_circle" : "volume_up"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="text-[10px] text-text-secondary mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-surface-ai p-3 rounded-2xl w-20">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
              <button
                type="button"
                onClick={handleCancelRequest}
                className="text-xs text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded bg-surface transition-colors"
                title="Cancel ongoing request"
              >
                Cancel
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Row */}
      <div className="pt-2 pb-1 border-t border-border bg-bg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          {speechSupported && (
            <button
              type="button"
              onClick={startVoiceInput}
              className="p-2.5 rounded-lg border border-border bg-surface text-primary hover:bg-primary-light transition-colors flex-shrink-0"
              title="Speak with on-device voice"
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
          )}

          <input
            type="text"
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask in Hindi, English, Tamil..."
            className="flex-1 bg-surface border border-border rounded-lg px-3.5 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors"
          />

          {loading ? (
            <button
              type="button"
              onClick={handleCancelRequest}
              className="p-2.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
              title="Stop request"
            >
              <span className="material-symbols-outlined text-[20px]">stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 rounded-lg border border-primary text-primary hover:bg-primary-light disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex-shrink-0"
              title="Send query"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
