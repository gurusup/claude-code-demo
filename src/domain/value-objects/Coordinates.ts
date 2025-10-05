// ABOUTME: Value object representing geographical coordinates with validation
// ABOUTME: Ensures latitude and longitude are within valid ranges

export class Coordinates {
  private readonly latitude: number;
  private readonly longitude: number;

  private constructor(latitude: number, longitude: number) {
    this.validate(latitude, longitude);
    this.latitude = latitude;
    this.longitude = longitude;
  }

  static create(latitude: number, longitude: number): Coordinates {
    return new Coordinates(latitude, longitude);
  }

  private validate(lat: number, lon: number): void {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error('Coordinates must be numbers');
    }
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error('Coordinates cannot be NaN');
    }
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (lon < -180 || lon > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  getLatitude(): number {
    return this.latitude;
  }

  getLongitude(): number {
    return this.longitude;
  }

  distanceTo(other: Coordinates): number {
    // Haversine formula for calculating distance between two points on Earth
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(other.latitude - this.latitude);
    const dLon = this.toRadians(other.longitude - this.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(this.latitude)) *
        Math.cos(this.toRadians(other.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  equals(other: Coordinates): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }

  toString(): string {
    return `${this.latitude},${this.longitude}`;
  }

  toObject(): { latitude: number; longitude: number } {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}