// ABOUTME: Implements IWeatherService using OpenMeteo API
// ABOUTME: Converts domain Coordinates to API requests and responses to domain models

import { IWeatherService, WeatherData, WeatherForecast } from '../../../application/ports/outbound/IWeatherService';
import { Coordinates } from '../../../domain/value-objects/Coordinates';

export class WeatherToolAdapter implements IWeatherService {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';
  private readonly serviceName = 'OpenMeteo';

  async getCurrentWeather(coordinates: Coordinates): Promise<WeatherData> {
    try {
      const url = this.buildUrl(coordinates, {
        current: ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'wind_direction_10m', 'weather_code'],
        timezone: 'auto',
      });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseCurrentWeather(data);
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      throw new Error(`Weather service error: ${(error as Error).message}`);
    }
  }

  async getForecast(coordinates: Coordinates, days: number = 7): Promise<WeatherForecast> {
    try {
      const url = this.buildUrl(coordinates, {
        current: ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'wind_direction_10m', 'weather_code'],
        hourly: ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'weather_code'],
        daily: ['temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset', 'precipitation_sum', 'weather_code'],
        forecast_days: days,
        timezone: 'auto',
      });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseForecast(data);
    } catch (error) {
      console.error('Failed to fetch weather forecast:', error);
      throw new Error(`Weather service error: ${(error as Error).message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to fetch weather for a known location (London)
      const testCoordinates = Coordinates.create(51.5074, -0.1278);
      const url = this.buildUrl(testCoordinates, { current: ['temperature_2m'] });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.error('Weather service availability check failed:', error);
      return false;
    }
  }

  getServiceName(): string {
    return this.serviceName;
  }

  private buildUrl(coordinates: Coordinates, params: Record<string, any>): string {
    const url = new URL(this.baseUrl);

    url.searchParams.append('latitude', coordinates.getLatitude().toString());
    url.searchParams.append('longitude', coordinates.getLongitude().toString());

    // Add parameters
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
      } else {
        url.searchParams.append(key, value.toString());
      }
    });

    return url.toString();
  }

  private parseCurrentWeather(data: any): WeatherData {
    const current = data.current || data.current_weather || {};

    return {
      temperature: current.temperature_2m || current.temperature || 0,
      temperatureUnit: data.current_units?.temperature_2m || '°C',
      conditions: this.getWeatherDescription(current.weather_code || current.weathercode),
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m || current.windspeed,
      windDirection: this.getWindDirection(current.wind_direction_10m || current.winddirection),
      timezone: data.timezone,
    };
  }

  private parseForecast(data: any): WeatherForecast {
    const current = this.parseCurrentWeather(data);

    // Parse hourly data
    const hourly: WeatherData[] = [];
    if (data.hourly) {
      const hours = data.hourly.time || [];
      for (let i = 0; i < Math.min(hours.length, 24); i++) {
        hourly.push({
          temperature: data.hourly.temperature_2m?.[i] || 0,
          temperatureUnit: data.hourly_units?.temperature_2m || '°C',
          conditions: this.getWeatherDescription(data.hourly.weather_code?.[i]),
          humidity: data.hourly.relative_humidity_2m?.[i],
          precipitation: data.hourly.precipitation?.[i],
        });
      }
    }

    // Parse daily data
    const daily: WeatherData[] = [];
    if (data.daily) {
      const days = data.daily.time || [];
      for (let i = 0; i < days.length; i++) {
        daily.push({
          temperature: (data.daily.temperature_2m_max?.[i] + data.daily.temperature_2m_min?.[i]) / 2 || 0,
          temperatureUnit: data.daily_units?.temperature_2m_max || '°C',
          conditions: this.getWeatherDescription(data.daily.weather_code?.[i]),
          precipitation: data.daily.precipitation_sum?.[i],
          sunrise: data.daily.sunrise?.[i],
          sunset: data.daily.sunset?.[i],
        });
      }
    }

    return {
      current,
      hourly: hourly.length > 0 ? hourly : undefined,
      daily: daily.length > 0 ? daily : undefined,
    };
  }

  private getWeatherDescription(code: number): string {
    // WMO Weather interpretation codes
    const weatherCodes: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };

    return weatherCodes[code] || 'Unknown';
  }

  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
}