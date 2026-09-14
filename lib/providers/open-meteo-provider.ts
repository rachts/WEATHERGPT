// WeatherGPT — Open-Meteo Numerical Fallback Provider
// EXPLICITLY LABELED AS THIRD-PARTY FALLBACK. NEVER DISGUISED AS IMD DATA.

import { WeatherObservationProvider, ForecastProvider, WeatherObservationResult, ForecastResult } from "./types";
import { DailyForecastMetric } from "../types/weather";
import { degreesToCardinal } from "../utils/geo";

export const WMO_WEATHER_CODE_MAP: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export class OpenMeteoProvider implements WeatherObservationProvider, ForecastProvider {
  readonly id = "open_meteo";
  readonly name = "Open-Meteo Numerical Weather Prediction (ECMWF/GFS Multi-Model)";
  readonly isOfficial = false;

  private async fetchOpenMeteoJson(lat: number, lon: number): Promise<any | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=7`;
      const res = await fetch(url, {
        headers: { "User-Agent": "WeatherGPT-OpenData/1.0 (+https://github.com/rachts/WEATHERGPT)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getObservation(
    lat: number,
    lon: number,
    districtName: string,
    stateName: string
  ): Promise<WeatherObservationResult | null> {
    const json = await this.fetchOpenMeteoJson(lat, lon);
    if (!json?.current) return null;

    const cur = json.current;
    const daily = json.daily;
    const windDirDeg = cur.wind_direction_10m !== undefined ? Number(cur.wind_direction_10m) : null;
    const weatherCode = cur.weather_code !== undefined ? Number(cur.weather_code) : null;

    // Use daily precipitation sum for today if available, else null
    const rain24h = daily?.precipitation_sum?.[0] !== undefined ? Number(daily.precipitation_sum[0]) : null;

    return {
      temperatureC: cur.temperature_2m !== undefined ? Number(cur.temperature_2m) : null,
      humidityPct: cur.relative_humidity_2m !== undefined ? Number(cur.relative_humidity_2m) : null,
      windSpeedKmh: cur.wind_speed_10m !== undefined ? Number(cur.wind_speed_10m) : null,
      windDirectionCardinal: degreesToCardinal(windDirDeg),
      windDirectionDegrees: windDirDeg,
      rainfallLast24hMm: rain24h,
      pressureHpa: cur.pressure_msl !== undefined ? Number(cur.pressure_msl) : null,
      condition: weatherCode !== null ? (WMO_WEATHER_CODE_MAP[weatherCode] || "Overcast") : "Partly cloudy",
      observedAt: cur.time ? `${cur.time}:00+05:30` : null,
      provenance: {
        provider: "OPEN_METEO",
        providerName: "Open-Meteo Numerical Prediction Service",
        sourceProduct: `Open-Meteo Model Forecast (${districtName}, ${stateName}) — Secondary Fallback`,
        sourceUrl: "https://open-meteo.com",
        retrievedAt: new Date().toISOString(),
        quality: "FALLBACK",
        isOfficial: false,
        isFallback: true,
      },
    };
  }

  async getForecast(
    lat: number,
    lon: number,
    districtName: string,
    stateName: string
  ): Promise<ForecastResult | null> {
    const json = await this.fetchOpenMeteoJson(lat, lon);
    if (!json?.daily?.time || !Array.isArray(json.daily.time)) return null;

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daily: DailyForecastMetric[] = [];
    const d = json.daily;

    for (let i = 0; i < d.time.length; i++) {
      const dateStr = d.time[i]; // "YYYY-MM-DD"
      // Explicit IST offset to guarantee accurate day-of-week parsing
      const dateObj = new Date(`${dateStr}T00:00:00+05:30`);
      const dayLabel = i === 0 ? "Today" : (isNaN(dateObj.getTime()) ? dateStr : daysOfWeek[dateObj.getDay()]);
      const wmoCode = d.weather_code?.[i] !== undefined ? Number(d.weather_code[i]) : 0;
      const rainMm = d.precipitation_sum?.[i] !== undefined ? Number(d.precipitation_sum[i]) : null;

      daily.push({
        day: dayLabel,
        date: dateStr,
        condition: WMO_WEATHER_CODE_MAP[wmoCode] || "Clear",
        tempMin: d.temperature_2m_min?.[i] !== undefined ? Number(d.temperature_2m_min[i]) : null,
        tempMax: d.temperature_2m_max?.[i] !== undefined ? Number(d.temperature_2m_max[i]) : null,
        rainfallMm: rainMm,
        pop: d.precipitation_probability_max?.[i] !== undefined ? Number(d.precipitation_probability_max[i]) : null,
        provenance: {
          provider: "OPEN_METEO",
          providerName: "Open-Meteo Numerical Prediction Service",
          sourceProduct: "Open-Meteo 7-Day Numerical Outlook",
          sourceUrl: "https://open-meteo.com",
          retrievedAt: new Date().toISOString(),
          quality: "FORECAST",
          isOfficial: false,
          isFallback: true,
        },
      });
    }

    const forecastRainfallNext24hMm = daily[0]?.rainfallMm ?? 0;

    return {
      daily,
      forecastRainfallNext24hMm,
      provenance: {
        provider: "OPEN_METEO",
        providerName: "Open-Meteo Numerical Prediction Service",
        sourceProduct: "Open-Meteo 7-Day Numerical Outlook",
        sourceUrl: "https://open-meteo.com",
        retrievedAt: new Date().toISOString(),
        quality: "FORECAST",
        isOfficial: false,
        isFallback: true,
      },
    };
  }
}
