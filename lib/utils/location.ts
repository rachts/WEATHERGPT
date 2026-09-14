// WeatherGPT — Pan-India Location Resolution Utilities
// Covers all 28 States and 8 Union Territories across India (36 administrative entities, 783 districts)

import indiaDistrictsData from "../data/india-districts.json";

export interface DistrictInfo {
  name: string;
  headquarters?: string | null;
  lat: number;
  lon: number;
  crops: string[];
  station: string;
  state: string;
  type: "State" | "Union Territory";
  metCentre: string;
}

export interface RawDistrict {
  name: string;
  headquarters?: string | null;
  lat: number;
  lon: number;
  crops?: string[] | null;
  station?: string | null;
}

export interface StateInfo {
  state: string;
  type: "State" | "Union Territory";
  metCentre: string;
  districts: RawDistrict[];
}

const rawData = indiaDistrictsData as StateInfo[];

// Representative regional agricultural crops by State/UT for fallback
const STATE_DEFAULT_CROPS: Record<string, string[]> = {
  "Andhra Pradesh": ["Paddy", "Cotton", "Chilli"],
  "Arunachal Pradesh": ["Paddy", "Maize", "Ginger"],
  "Assam": ["Tea", "Paddy", "Mustard"],
  "Bihar": ["Paddy", "Wheat", "Maize"],
  "Chhattisgarh": ["Paddy", "Minor Millets", "Pulses"],
  "Goa": ["Paddy", "Cashew", "Coconut"],
  "Gujarat": ["Cotton", "Groundnut", "Wheat"],
  "Haryana": ["Wheat", "Basmati Paddy", "Mustard"],
  "Himachal Pradesh": ["Apple", "Maize", "Potato"],
  "Jharkhand": ["Paddy", "Pulses", "Maize"],
  "Karnataka": ["Paddy", "Ragi", "Sugarcane"],
  "Kerala": ["Coconut", "Spices", "Rubber"],
  "Madhya Pradesh": ["Soybean", "Wheat", "Gram"],
  "Maharashtra": ["Cotton", "Sugarcane", "Soybean"],
  "Manipur": ["Paddy", "Maize", "Ginger"],
  "Meghalaya": ["Potato", "Ginger", "Paddy"],
  "Mizoram": ["Paddy", "Ginger", "Turmeric"],
  "Nagaland": ["Paddy", "Maize", "Soybean"],
  "Odisha": ["Paddy", "Pulses", "Groundnut"],
  "Punjab": ["Wheat", "Paddy", "Cotton"],
  "Rajasthan": ["Mustard", "Wheat", "Bajra"],
  "Sikkim": ["Large Cardamom", "Ginger", "Maize"],
  "Tamil Nadu": ["Paddy", "Cotton", "Sugarcane"],
  "Telangana": ["Cotton", "Chilli", "Paddy"],
  "Tripura": ["Paddy", "Rubber", "Pineapple"],
  "Uttar Pradesh": ["Wheat", "Paddy", "Sugarcane"],
  "Uttarakhand": ["Basmati Paddy", "Wheat", "Apple"],
  "West Bengal": ["Paddy", "Jute", "Potato"],
  "Andaman and Nicobar Islands": ["Coconut", "Arecanut", "Paddy"],
  "Chandigarh": ["Wheat", "Vegetables", "Maize"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Paddy", "Coconut", "Groundnut"],
  "Delhi": ["Vegetables", "Wheat", "Mustard"],
  "Jammu and Kashmir": ["Apple", "Paddy", "Wheat"],
  "Ladakh": ["Barley", "Apricot", "Wheat"],
  "Lakshadweep": ["Coconut", "Banana", "Marine Fisheries"],
  "Puducherry": ["Paddy", "Sugarcane", "Pulses"],
};

/**
 * Normalizes raw district info, guaranteeing non-empty crops and valid station strings
 */
function normalizeDistrict(
  d: RawDistrict,
  state: string,
  type: "State" | "Union Territory",
  metCentre: string
): DistrictInfo {
  const fallbackCrops = STATE_DEFAULT_CROPS[state] || ["Paddy", "Wheat", "Pulses"];
  const crops = (Array.isArray(d.crops) && d.crops.length > 0) ? d.crops : fallbackCrops;
  const station = d.station && d.station.trim().length > 0 ? d.station : `${d.name} Agromet Station`;

  return {
    name: d.name,
    headquarters: d.headquarters ?? null,
    lat: d.lat,
    lon: d.lon,
    crops,
    station,
    state,
    type,
    metCentre,
  };
}

/**
 * Get list of all 36 States & Union Territories
 */
export function getAllStates(): StateInfo[] {
  return rawData;
}

/**
 * Flattened list of all 783 agricultural districts across India
 */
export function getAllDistricts(): DistrictInfo[] {
  const list: DistrictInfo[] = [];
  for (const stateItem of rawData) {
    for (const d of stateItem.districts) {
      list.push(normalizeDistrict(d, stateItem.state, stateItem.type, stateItem.metCentre));
    }
  }
  return list;
}

/**
 * Get all districts belonging to a specific state or UT
 */
export function getDistrictsByState(stateName: string): DistrictInfo[] {
  const match = rawData.find(
    (s) => s.state.toLowerCase() === stateName.trim().toLowerCase()
  );
  if (!match) return [];
  return match.districts.map((d) =>
    normalizeDistrict(d, match.state, match.type, match.metCentre)
  );
}

/**
 * Find district information by name
 */
export function findDistrictInfo(districtName: string): DistrictInfo | null {
  if (!districtName) return null;
  const target = districtName.trim().toLowerCase();

  for (const s of rawData) {
    for (const d of s.districts) {
      if (d.name.toLowerCase() === target) {
        return normalizeDistrict(d, s.state, s.type, s.metCentre);
      }
    }
  }
  return null;
}

/**
 * Haversine formula to compute great-circle distance between two coordinates in kilometers
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Map arbitrary GPS coordinates to the nearest Indian agricultural district
 */
export function getNearestDistrict(latitude: number, longitude: number): DistrictInfo {
  const all = getAllDistricts();
  let nearest = all[0];
  let minDistance = Infinity;

  for (const d of all) {
    const dist = haversineDistanceKm(latitude, longitude, d.lat, d.lon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = d;
    }
  }

  return nearest;
}

export const LOCATION_CHANGE_EVENT = "weathergpt_location_changed";

/**
 * Read the active district and state from client localStorage (defaulting to Raigad, Maharashtra)
 */
export function getActiveLocation(): { district: string; state: string } {
  if (typeof window === "undefined") {
    return { district: "Raigad", state: "Maharashtra" };
  }
  const district = localStorage.getItem("weathergpt_district") || "Raigad";
  const state = localStorage.getItem("weathergpt_state") || "Maharashtra";
  return { district, state };
}

/**
 * Set active location and dispatch sync event
 */
export function setActiveLocation(district: string, state?: string): void {
  if (typeof window === "undefined") return;

  const info = findDistrictInfo(district);
  const finalState = state || (info ? info.state : "Maharashtra");

  localStorage.setItem("weathergpt_district", district);
  localStorage.setItem("weathergpt_state", finalState);

  window.dispatchEvent(
    new CustomEvent(LOCATION_CHANGE_EVENT, {
      detail: { district, state: finalState },
    })
  );
}
