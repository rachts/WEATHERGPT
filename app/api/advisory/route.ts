import { NextRequest, NextResponse } from "next/server";
import { getDeterministicCropAdvisory } from "@/lib/services/advisory-rules";
import { getDistrictWeather } from "@/lib/services/weather-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const crop = searchParams.get("crop") || "paddy";
  const district = searchParams.get("district") || "Raigad";
  const language = (searchParams.get("language") || "en-IN") as "hi-IN" | "ta-IN" | "en-IN";

  const weather = await getDistrictWeather(district);
  const advisory = getDeterministicCropAdvisory(crop, district, {
    temperature: weather.current.temperature,
    humidity: weather.current.humidity,
    windSpeed: weather.current.windSpeed,
    windDirection: weather.current.windDirection,
    rainfallLast24h: weather.current.rainfallLast24h,
    rainfallForecastNext24h: weather.forecastDaily[0]?.rainfallMm ?? 10,
  }, language);

  return NextResponse.json(advisory);
}
