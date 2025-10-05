// ABOUTME: Port for weather data retrieval
// ABOUTME: Abstracts weather API implementations for testability

import { Coordinates } from '../../../domain/value-objects/Coordinates';

export interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  conditions: string;
  humidity?: number;
  windSpeed?: number;
  windDirection?: string;
  precipitation?: number;
  sunrise?: string;
  sunset?: string;
  timezone?: string;
}

export interface WeatherForecast {
  current: WeatherData;
  hourly?: WeatherData[];
  daily?: WeatherData[];
}

export interface IWeatherService {
  /**
   * Gets current weather for coordinates
   */
  getCurrentWeather(coordinates: Coordinates): Promise<WeatherData>;

  /**
   * Gets weather forecast
   */
  getForecast(coordinates: Coordinates, days?: number): Promise<WeatherForecast>;

  /**
   * Validates service availability
   */
  isAvailable(): Promise<boolean>;

  /**
   * Gets service name
   */
  getServiceName(): string;
}