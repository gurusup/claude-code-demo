// ABOUTME: Weather tool implementation that integrates with the tool registry
// ABOUTME: Fetches raw weather data directly from OpenMeteo API for UI components

import { ITool } from '../../../application/ports/outbound/IToolRegistry';
import { IWeatherService } from '../../../application/ports/outbound/IWeatherService';
import { ToolName } from '../../../domain/value-objects/ToolName';

export class WeatherTool implements ITool {
  private readonly name: ToolName;
  private readonly description: string;

  constructor(private readonly weatherService: IWeatherService) {
    // Note: weatherService is kept in constructor for compatibility but not used
    // The execute method fetches directly from OpenMeteo API to return raw data
    this.name = ToolName.from('get_current_weather');
    this.description = 'Get the current weather at a location specified by latitude and longitude';
  }

  getName(): ToolName {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getParameters(): {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  } {
    return {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'The latitude of the location',
          minimum: -90,
          maximum: 90,
        },
        longitude: {
          type: 'number',
          description: 'The longitude of the location',
          minimum: -180,
          maximum: 180,
        },
      },
      required: ['latitude', 'longitude'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<unknown> {
    // Validate and extract arguments
    const { latitude, longitude } = this.extractArgs(args);

    // For the Weather component, we need to return the raw OpenMeteo API response
    // Instead of using the domain service, we'll fetch directly
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      // Return the raw API response that the Weather component expects
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      throw new Error(`Weather service error: ${(error as Error).message}`);
    }
  }

  validateArgs(args: Record<string, unknown>): boolean {
    try {
      this.extractArgs(args);
      return true;
    } catch {
      return false;
    }
  }

  private extractArgs(args: Record<string, unknown>): { latitude: number; longitude: number } {
    const latitude = args.latitude;
    const longitude = args.longitude;

    // Validate presence
    if (latitude === undefined || longitude === undefined) {
      throw new Error('Missing required parameters: latitude and longitude');
    }

    // Validate types
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Latitude and longitude must be numbers');
    }

    // Validate ranges
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    return { latitude, longitude };
  }
}