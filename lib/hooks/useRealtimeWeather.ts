"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { NormalizedWeather } from "@/lib/services/weather-data";
import type { IMDWarningProduct } from "@/lib/services/alerts";

export interface RealtimeTelemetry {
  type: "telemetry";
  district: string;
  state?: string;
  weather: NormalizedWeather | null;
  alerts: IMDWarningProduct[];
  timestamp: string;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface UseRealtimeWeatherOptions {
  district: string;
  state?: string;
  enabled?: boolean;
  onUpdate?: (telemetry: RealtimeTelemetry) => void;
}

export function useRealtimeWeather({
  district,
  state,
  enabled = true,
  onUpdate,
}: UseRealtimeWeatherOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [telemetry, setTelemetry] = useState<RealtimeTelemetry | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const connect = useCallback(() => {
    if (!enabled || !district || typeof window === "undefined") return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus("connecting");

    const params = new URLSearchParams({ district });
    if (state) params.set("state", state);

    const url = `/api/realtime?${params.toString()}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("connection", () => {
      setStatus("connected");
    });

    es.addEventListener("telemetry", (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeTelemetry;
        setTelemetry(data);
        setLastUpdated(new Date());
        setStatus("connected");
        if (onUpdateRef.current) {
          onUpdateRef.current(data);
        }
      } catch (err) {
        console.warn("Failed to parse realtime telemetry event:", err);
      }
    });

    es.onerror = () => {
      setStatus("reconnecting");
      // EventSource natively attempts automatic reconnect
    };
  }, [district, state, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus("idle");
    };
  }, [connect]);

  return {
    status,
    isConnected: status === "connected",
    telemetry,
    lastUpdated,
    reconnect: connect,
  };
}
