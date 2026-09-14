import React from "react";
import type { Metadata } from "next";
import SatelliteView from "@/components/SatelliteView";

export const metadata: Metadata = {
  title: "Real-Time Satellite Imagery & Depressions — WeatherGPT",
  description:
    "Real-time Earth observation satellite imagery, IMD INSAT-3D/3DR geostationary feeds, and active tropical depression tracking for India.",
};

export default function SatellitePage() {
  return (
    <div className="py-4">
      <SatelliteView />
    </div>
  );
}
