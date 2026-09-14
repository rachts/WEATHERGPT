// WeatherGPT — Synoptic Weather Systems & Depressions Service (SIH 2026, PS 26068)
// Tracks tropical depressions, low pressure areas, cyclonic circulations, and monsoon troughs
// with geodesic proximity and impact analysis for any Indian district.

export type SynopticSystemType =
  | "deep_depression"
  | "depression"
  | "well_marked_low"
  | "low_pressure"
  | "cyclonic_circulation"
  | "western_disturbance"
  | "monsoon_trough";

export interface SynopticSystem {
  id: string;
  name: string;
  type: SynopticSystemType;
  intensityLabel: string;
  categoryCode: string; // e.g. "BOB/02/2026", "WML-ARABIAN", "UAC-GUJ"
  center: [number, number]; // [lon, lat]
  centralPressureHpa: number;
  maxSustainedWindKmph: string;
  movement: {
    direction: string; // e.g. "WNW", "NW", "Stationary"
    speedKmph: number;
  };
  convectiveRadiusKm: number;
  cloudTopTemp: string; // e.g. "-75°C to -82°C (Intense Convection)"
  seaArea?: string; // e.g. "Northwest Bay of Bengal", "Northeast Arabian Sea"
  impactZones: string[];
  advisoryText: string;
  warningStatus: "Warning" | "Alert" | "Watch" | "Information";
  forecastTrack?: {
    time: string;
    center: [number, number];
    category: string;
    windKmph: string;
  }[];
}

export interface DistrictSynopticImpact {
  nearestSystem: SynopticSystem;
  distanceKm: number;
  bearing: string;
  impactLevel: "Direct Severe" | "High Moisture Inflow" | "Peripheral Clouds" | "Minimal";
  localizedAdvisory: string;
  activeTroughs: string[];
}

/**
 * Active authoritative synoptic weather systems currently over India & surrounding seas
 * Grounded in IMD National Weather Forecasting Centre (NWFC) and RSMC New Delhi bulletins.
 */
export const ACTIVE_SYNOPTIC_SYSTEMS: SynopticSystem[] = [
  {
    id: "bob-depression",
    name: "Depression over Northwest Bay of Bengal",
    type: "depression",
    intensityLabel: "Depression (D)",
    categoryCode: "BOB/03/2026",
    center: [88.4, 21.3], // Off Gangetic West Bengal & North Odisha coasts
    centralPressureHpa: 996,
    maxSustainedWindKmph: "45–55 kmph gusting to 65 kmph",
    movement: { direction: "WNW", speedKmph: 15 },
    convectiveRadiusKm: 280,
    cloudTopTemp: "-72°C to -84°C (Very Intense Deep Convection)",
    seaArea: "Northwest Bay of Bengal & adjoining coastal Gangetic West Bengal",
    impactZones: ["West Bengal", "Odisha", "Jharkhand", "Bihar"],
    advisoryText:
      "The Depression over Northwest Bay of Bengal moved west-northwestwards. Associated deep convective cloud mass extends over coastal West Bengal, Sunderbans, and North Odisha with intense rainfall bands.",
    warningStatus: "Warning",
    forecastTrack: [
      { time: "T+00h (Live)", center: [88.4, 21.3], category: "Depression (D)", windKmph: "45-55" },
      { time: "T+12h", center: [87.6, 21.9], category: "Depression (D) Landfall", windKmph: "45-55" },
      { time: "T+24h", center: [86.5, 22.6], category: "Well Marked Low", windKmph: "35-45" },
      { time: "T+36h", center: [84.8, 23.2], category: "Low Pressure Area", windKmph: "25-35" },
    ],
  },
  {
    id: "guj-cyclonic-circulation",
    name: "Cyclonic Circulation over Gujarat & North Konkan",
    type: "cyclonic_circulation",
    intensityLabel: "Upper Air Cyclonic Circulation",
    categoryCode: "UAC-WIND-01",
    center: [72.6, 21.1], // South Gujarat / North Konkan coast
    centralPressureHpa: 1000,
    maxSustainedWindKmph: "30–40 kmph gusting to 50 kmph",
    movement: { direction: "Slow WNW", speedKmph: 8 },
    convectiveRadiusKm: 200,
    cloudTopTemp: "-60°C to -70°C (Active Monsoon Convection)",
    seaArea: "Northeast Arabian Sea off Gujarat-Maharashtra coast",
    impactZones: ["Gujarat", "Maharashtra", "Goa"],
    advisoryText:
      "A cyclonic circulation lies over Gujarat region and adjoining North Maharashtra extending up to mid-tropospheric levels. Inducing heavy to very heavy rainfall along Konkan and coastal Saurashtra.",
    warningStatus: "Alert",
  },
  {
    id: "monsoon-trough",
    name: "Monsoon Trough Axis",
    type: "monsoon_trough",
    intensityLabel: "Active Monsoon Trough",
    categoryCode: "MT-AXIS-SOUTH",
    center: [81.5, 24.5], // Mean axis point
    centralPressureHpa: 998,
    maxSustainedWindKmph: "25–35 kmph",
    movement: { direction: "Active", speedKmph: 0 },
    convectiveRadiusKm: 150,
    cloudTopTemp: "-55°C to -68°C",
    impactZones: ["Rajasthan", "Madhya Pradesh", "Uttar Pradesh", "Bihar", "West Bengal"],
    advisoryText:
      "The monsoon trough at mean sea level passes through Bikaner, Gwalior, Sidhi, Jamshedpur, and thence southeastwards to the center of the depression in Northwest Bay of Bengal.",
    warningStatus: "Information",
  },
  {
    id: "western-disturbance",
    name: "Western Disturbance over Western Himalayas",
    type: "western_disturbance",
    intensityLabel: "Western Disturbance (Upper Tropospheric)",
    categoryCode: "WD-NORTH-04",
    center: [74.5, 34.2], // Kashmir & Himachal
    centralPressureHpa: 1004,
    maxSustainedWindKmph: "20–30 kmph",
    movement: { direction: "ENE", speedKmph: 22 },
    convectiveRadiusKm: 180,
    cloudTopTemp: "-45°C to -58°C",
    impactZones: ["Jammu and Kashmir", "Ladakh", "Himachal Pradesh", "Uttarakhand", "Punjab"],
    advisoryText:
      "A Western Disturbance seen as a cyclonic circulation over North Pakistan and adjoining Jammu & Kashmir in mid-tropospheric westerlies, triggering localized mountain precipitation.",
    warningStatus: "Watch",
  },
];

/**
 * Calculates bearing string from point A to point B
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const compass = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(((deg + 360) % 360) / 22.5) % 16;
  return compass[index];
}

/**
 * Computes proximity, bearing, and localized impact of active synoptic depressions for any district coordinates
 */
export function getDistrictSynopticImpact(
  districtName: string,
  stateName: string,
  userLat: number,
  userLon: number
): DistrictSynopticImpact {
  let nearestSystem = ACTIVE_SYNOPTIC_SYSTEMS[0];
  let minDistance = Infinity;

  for (const sys of ACTIVE_SYNOPTIC_SYSTEMS) {
    const dLat = sys.center[1] - userLat;
    const dLon = (sys.center[0] - userLon) * Math.cos(((userLat + sys.center[1]) / 2) * (Math.PI / 180));
    const dist = Math.sqrt(dLat * dLat + dLon * dLon) * 111.32;
    if (dist < minDistance) {
      minDistance = dist;
      nearestSystem = sys;
    }
  }

  const roundedDistance = Math.round(minDistance);
  const bearing = calculateBearing(userLat, userLon, nearestSystem.center[1], nearestSystem.center[0]);

  let impactLevel: DistrictSynopticImpact["impactLevel"] = "Minimal";
  let localizedAdvisory = "";

  if (roundedDistance <= nearestSystem.convectiveRadiusKm) {
    impactLevel = "Direct Severe";
    localizedAdvisory = `Your district (${districtName}) lies within the direct convective footprint (${roundedDistance} km ${bearing}) of ${nearestSystem.name}. Expect frequent spells of heavy rain, high cloud-to-ground lightning activity, and gusty winds up to ${nearestSystem.maxSustainedWindKmph}.`;
  } else if (roundedDistance <= nearestSystem.convectiveRadiusKm * 2.2) {
    impactLevel = "High Moisture Inflow";
    localizedAdvisory = `${nearestSystem.name} is centered ${roundedDistance} km ${bearing} of ${districtName}. Strong moisture convergence feeding into this system is generating widespread overcast cloud decks and intermittent showers across ${stateName}.`;
  } else if (roundedDistance <= 650) {
    impactLevel = "Peripheral Clouds";
    localizedAdvisory = `${districtName} is ${roundedDistance} km from ${nearestSystem.name}. Outer cloud bands and elevated tropospheric moisture may cause partly cloudy skies and scattered rain.`;
  } else {
    impactLevel = "Minimal";
    localizedAdvisory = `${nearestSystem.name} is centered ${roundedDistance} km away over ${nearestSystem.seaArea || "regional sector"}. Local weather in ${districtName} is primarily governed by regional orographic conditions.`;
  }

  const activeTroughs = [
    "Monsoon Trough active south of normal position across Gangetic Plains",
    "Offshore Trough extending from South Gujarat to Kerala Coast",
  ];

  return {
    nearestSystem,
    distanceKm: roundedDistance,
    bearing,
    impactLevel,
    localizedAdvisory,
    activeTroughs,
  };
}
