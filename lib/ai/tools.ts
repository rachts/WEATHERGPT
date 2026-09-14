// WeatherGPT — Vercel AI SDK Tool Definitions
// Connects the conversational model to verified IMD weather telemetry and forecasts.

import { z } from "zod";
import { getDistrictWeather } from "@/lib/services/weather-data";

export const getWeather = {
  description:
    "Retrieve live weather observations, current conditions, and official 7-day forecasts for any Indian district from India Meteorological Department (IMD) Open Data.",
  parameters: z.object({
    district: z
      .string()
      .optional()
      .describe("Name of the district in India (e.g. Kolkata, Raigad, Pune, Ludhiana, Chennai, Patna)"),
    location: z
      .string()
      .optional()
      .describe("Alternative name for the district/city"),
    city: z
      .string()
      .optional()
      .describe("City or district name"),
    state: z.string().optional().describe("Optional state name to disambiguate district"),
  }),
  execute: async ({
    district,
    location,
    city,
  }: {
    district?: string;
    location?: string;
    city?: string;
    state?: string;
  }) => {
    const targetDistrict = district || location || city || "Kolkata";
    try {
      const data = await getDistrictWeather(targetDistrict);
      return {
        success: true,
        district: data.district,
        state: data.state,
        coordinates: data.coordinates,
        current: data.current,
        forecastDaily: data.forecastDaily,
        radarNowcast: data.radarNowcast,
        sourceProduct: data.sourceProduct,
        issueTime: data.issueTime,
        validUntil: data.validUntil,
        isCachedFallback: data.isCachedFallback,
      };
    } catch (err) {
      return {
        success: false,
        error: true,
        message:
          err instanceof Error
            ? err.message
            : "Weather telemetry is temporarily unavailable for this district.",
        district,
      };
    }
  },
};
