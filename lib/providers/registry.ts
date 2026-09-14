// WeatherGPT — Provider Registry & Degradation Policy Engine

import { APP_CONFIG } from "../config/environment";
import { WeatherObservationProvider, ForecastProvider } from "./types";
import { ImdObservationProvider } from "./imd-provider";
import { OpenMeteoProvider } from "./open-meteo-provider";

export class ProviderRegistry {
  private static observationProviders: WeatherObservationProvider[] = [
    new ImdObservationProvider(),
    new OpenMeteoProvider(),
  ];

  private static forecastProviders: ForecastProvider[] = [
    new OpenMeteoProvider(),
  ];

  static getObservationProviders(): WeatherObservationProvider[] {
    return this.observationProviders;
  }

  static getForecastProviders(): ForecastProvider[] {
    return this.forecastProviders;
  }

  static getPrimaryObservationProvider(): WeatherObservationProvider {
    return this.observationProviders[0];
  }

  static getFallbackObservationProvider(): WeatherObservationProvider {
    return this.observationProviders[1];
  }

  static getPrimaryForecastProvider(): ForecastProvider {
    return this.forecastProviders[0];
  }
}
