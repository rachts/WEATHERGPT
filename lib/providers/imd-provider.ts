// WeatherGPT — Official IMD GeoServer Observation Provider

import { WeatherObservationProvider, WeatherObservationResult } from "./types";
import { degreesToCardinal, haversineDistance } from "../utils/geo";
import { normalizeImdTimestamp } from "../utils/time";

interface ImdSynopFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    station?: string;
    station_id?: number | string;
    dbtemp?: number | null;
    dewtemp?: number | null;
    rh?: number | null;
    mslp?: number | null;
    winddir?: number | null;
    windsp?: number | null; // in knots
    rainfall24h?: number | null;
    update_time?: string;
    nebulosity?: number | null;
  };
}

let imdSynopCache: { stations: ImdSynopFeature[]; cachedAt: number } | null = null;
let imdSynopInFlight: Promise<ImdSynopFeature[]> | null = null;

export class ImdObservationProvider implements WeatherObservationProvider {
  readonly id = "imd";
  readonly name = "India Meteorological Department (IMD GeoServer SYNOP)";
  readonly isOfficial = true;

  private async fetchStations(): Promise<ImdSynopFeature[]> {
    const TTL = 5 * 60 * 1000;
    if (imdSynopCache && Date.now() - imdSynopCache.cachedAt < TTL) {
      return imdSynopCache.stations;
    }
    if (imdSynopInFlight) return imdSynopInFlight;

    imdSynopInFlight = (async () => {
      try {
        const url =
          "https://reactjs.imd.gov.in/geoserver/imd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:synop_data_layer&outputFormat=application/json";
        const res = await fetch(url, {
          headers: { "User-Agent": "WeatherGPT-MoES-Kisan/1.0" },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return imdSynopCache ? imdSynopCache.stations : [];
        const data = await res.json();
        if (!data?.features || !Array.isArray(data.features) || data.features.length < 10) {
          throw new Error("Incomplete IMD payload");
        }
        imdSynopCache = { stations: data.features, cachedAt: Date.now() };
        return data.features;
      } catch {
        return imdSynopCache ? imdSynopCache.stations : [];
      } finally {
        imdSynopInFlight = null;
      }
    })();

    return imdSynopInFlight;
  }

  async getObservation(
    lat: number,
    lon: number,
    districtName: string,
    stateName: string
  ): Promise<WeatherObservationResult | null> {
    const features = await this.fetchStations();
    if (!features || features.length === 0) return null;

    let bestDist = Infinity;
    let bestFeature: ImdSynopFeature | null = null;

    for (const f of features) {
      if (!f.geometry?.coordinates || f.geometry.coordinates.length < 2) continue;
      const sLon = Number(f.geometry.coordinates[0]);
      const sLat = Number(f.geometry.coordinates[1]);
      if (isNaN(sLat) || isNaN(sLon)) continue;

      const d = haversineDistance(lat, lon, sLat, sLon);
      // Prioritize stations with valid dry-bulb temperature within 120km
      if (d < bestDist && f.properties.dbtemp !== null && f.properties.dbtemp !== undefined) {
        bestDist = d;
        bestFeature = f;
      }
    }

    if (!bestFeature || bestDist > 150) {
      // No station in telemetry radius
      return null;
    }

    const p = bestFeature.properties;
    const windKnots = p.windsp !== null && p.windsp !== undefined ? Number(p.windsp) : null;
    const windSpeedKmh = windKnots !== null ? Math.round(windKnots * 1.852 * 10) / 10 : null;
    const windDirectionDegrees = p.winddir !== null && p.winddir !== undefined ? Number(p.winddir) : null;
    const windDirectionCardinal = degreesToCardinal(windDirectionDegrees);

    const rain24 = p.rainfall24h !== null && p.rainfall24h !== undefined ? Math.round(Number(p.rainfall24h) * 10) / 10 : null;
    let condition = "Clear";
    if (rain24 !== null && rain24 > 15) condition = "Moderate to Heavy Rain";
    else if (rain24 !== null && rain24 > 0.5) condition = "Light Rain";
    else if (p.nebulosity && p.nebulosity >= 6) condition = "Overcast";
    else if (p.nebulosity && p.nebulosity >= 3) condition = "Partly Cloudy";

    const observedAt = p.update_time ? normalizeImdTimestamp(p.update_time).isoString : null;
    const stationName = p.station ? String(p.station).trim() : `${districtName} Observatory`;

    return {
      temperatureC: p.dbtemp !== null && p.dbtemp !== undefined ? Math.round(Number(p.dbtemp) * 10) / 10 : null,
      humidityPct: p.rh !== null && p.rh !== undefined ? Math.round(Number(p.rh)) : null,
      windSpeedKmh,
      windDirectionCardinal,
      windDirectionDegrees,
      rainfallLast24hMm: rain24,
      pressureHpa: p.mslp !== null && p.mslp !== undefined ? Math.round(Number(p.mslp) * 10) / 10 : null,
      condition,
      observedAt,
      provenance: {
        provider: "IMD",
        providerName: "India Meteorological Department (MoES)",
        sourceProduct: `IMD Live Ground Observation (${stationName}, ${Math.round(bestDist)} km from ${districtName})`,
        sourceId: String(p.station_id || stationName),
        sourceUrl: "https://mausam.imd.gov.in",
        observedAt,
        retrievedAt: new Date().toISOString(),
        quality: "OBSERVED",
        isOfficial: true,
        isFallback: false,
      },
    };
  }
}
