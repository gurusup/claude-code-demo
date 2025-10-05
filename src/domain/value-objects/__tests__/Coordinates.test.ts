// ABOUTME: Unit tests for Coordinates value object
// ABOUTME: Tests coordinate validation, distance calculations, and boundary conditions

import { describe, it, expect } from 'vitest';
import { Coordinates } from '../Coordinates';

describe('Coordinates', () => {
  describe('create()', () => {
    describe('Valid coordinates', () => {
      it('should create coordinates with valid latitude and longitude', () => {
        const coords = Coordinates.create(40.7128, -74.006);
        expect(coords.getLatitude()).toBe(40.7128);
        expect(coords.getLongitude()).toBe(-74.006);
      });

      it('should accept equator and prime meridian (0, 0)', () => {
        const coords = Coordinates.create(0, 0);
        expect(coords.getLatitude()).toBe(0);
        expect(coords.getLongitude()).toBe(0);
      });

      it('should accept North Pole (90, 0)', () => {
        const coords = Coordinates.create(90, 0);
        expect(coords.getLatitude()).toBe(90);
        expect(coords.getLongitude()).toBe(0);
      });

      it('should accept South Pole (-90, 0)', () => {
        const coords = Coordinates.create(-90, 0);
        expect(coords.getLatitude()).toBe(-90);
        expect(coords.getLongitude()).toBe(0);
      });

      it('should accept International Date Line (0, 180)', () => {
        const coords = Coordinates.create(0, 180);
        expect(coords.getLatitude()).toBe(0);
        expect(coords.getLongitude()).toBe(180);
      });

      it('should accept International Date Line (0, -180)', () => {
        const coords = Coordinates.create(0, -180);
        expect(coords.getLatitude()).toBe(0);
        expect(coords.getLongitude()).toBe(-180);
      });

      it('should accept positive latitude and negative longitude', () => {
        const coords = Coordinates.create(51.5074, -0.1278); // London
        expect(coords.getLatitude()).toBe(51.5074);
        expect(coords.getLongitude()).toBe(-0.1278);
      });

      it('should accept negative latitude and positive longitude', () => {
        const coords = Coordinates.create(-33.8688, 151.2093); // Sydney
        expect(coords.getLatitude()).toBe(-33.8688);
        expect(coords.getLongitude()).toBe(151.2093);
      });
    });

    describe('Invalid type validation', () => {
      it('should throw for non-number latitude', () => {
        expect(() => Coordinates.create('40' as any, -74)).toThrow('must be numbers');
      });

      it('should throw for non-number longitude', () => {
        expect(() => Coordinates.create(40, '-74' as any)).toThrow('must be numbers');
      });

      it('should throw for null latitude', () => {
        expect(() => Coordinates.create(null as any, -74)).toThrow('must be numbers');
      });

      it('should throw for undefined longitude', () => {
        expect(() => Coordinates.create(40, undefined as any)).toThrow('must be numbers');
      });

      it('should throw for object as latitude', () => {
        expect(() => Coordinates.create({} as any, -74)).toThrow('must be numbers');
      });
    });

    describe('NaN validation', () => {
      it('should throw for NaN latitude', () => {
        expect(() => Coordinates.create(NaN, -74)).toThrow('cannot be NaN');
      });

      it('should throw for NaN longitude', () => {
        expect(() => Coordinates.create(40, NaN)).toThrow('cannot be NaN');
      });

      it('should throw for both NaN', () => {
        expect(() => Coordinates.create(NaN, NaN)).toThrow('cannot be NaN');
      });
    });

    describe('Latitude boundary validation', () => {
      it('should throw for latitude > 90', () => {
        expect(() => Coordinates.create(90.1, 0)).toThrow('Latitude must be between -90 and 90');
      });

      it('should throw for latitude < -90', () => {
        expect(() => Coordinates.create(-90.1, 0)).toThrow('Latitude must be between -90 and 90');
      });

      it('should throw for latitude = 100', () => {
        expect(() => Coordinates.create(100, 0)).toThrow('Latitude must be between -90 and 90');
      });

      it('should throw for latitude = -100', () => {
        expect(() => Coordinates.create(-100, 0)).toThrow('Latitude must be between -90 and 90');
      });

      it('should throw for latitude = Infinity', () => {
        expect(() => Coordinates.create(Infinity, 0)).toThrow('Latitude must be between -90 and 90');
      });

      it('should throw for latitude = -Infinity', () => {
        expect(() => Coordinates.create(-Infinity, 0)).toThrow('Latitude must be between -90 and 90');
      });
    });

    describe('Longitude boundary validation', () => {
      it('should throw for longitude > 180', () => {
        expect(() => Coordinates.create(0, 180.1)).toThrow('Longitude must be between -180 and 180');
      });

      it('should throw for longitude < -180', () => {
        expect(() => Coordinates.create(0, -180.1)).toThrow('Longitude must be between -180 and 180');
      });

      it('should throw for longitude = 200', () => {
        expect(() => Coordinates.create(0, 200)).toThrow('Longitude must be between -180 and 180');
      });

      it('should throw for longitude = -200', () => {
        expect(() => Coordinates.create(0, -200)).toThrow('Longitude must be between -180 and 180');
      });

      it('should throw for longitude = Infinity', () => {
        expect(() => Coordinates.create(0, Infinity)).toThrow('Longitude must be between -180 and 180');
      });

      it('should throw for longitude = -Infinity', () => {
        expect(() => Coordinates.create(0, -Infinity)).toThrow('Longitude must be between -180 and 180');
      });
    });
  });

  describe('distanceTo()', () => {
    it('should return 0 for same coordinates', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(40.7128, -74.006);
      expect(coords1.distanceTo(coords2)).toBe(0);
    });

    it('should calculate distance between New York and London', () => {
      const newYork = Coordinates.create(40.7128, -74.006);
      const london = Coordinates.create(51.5074, -0.1278);
      const distance = newYork.distanceTo(london);

      // Distance should be approximately 5570 km
      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });

    it('should calculate distance between Sydney and Tokyo', () => {
      const sydney = Coordinates.create(-33.8688, 151.2093);
      const tokyo = Coordinates.create(35.6762, 139.6503);
      const distance = sydney.distanceTo(tokyo);

      // Distance should be approximately 7800 km
      expect(distance).toBeGreaterThan(7700);
      expect(distance).toBeLessThan(7900);
    });

    it('should calculate distance from equator to North Pole', () => {
      const equator = Coordinates.create(0, 0);
      const northPole = Coordinates.create(90, 0);
      const distance = equator.distanceTo(northPole);

      // Distance should be approximately 10,000 km (quarter of Earth's circumference)
      expect(distance).toBeGreaterThan(9900);
      expect(distance).toBeLessThan(10100);
    });

    it('should be symmetric (distance A to B equals distance B to A)', () => {
      const coordsA = Coordinates.create(40.7128, -74.006);
      const coordsB = Coordinates.create(51.5074, -0.1278);

      expect(coordsA.distanceTo(coordsB)).toBe(coordsB.distanceTo(coordsA));
    });

    it('should calculate distance between close coordinates', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(40.7129, -74.006); // 0.0001 degree difference
      const distance = coords1.distanceTo(coords2);

      // Distance should be very small (less than 1 km)
      expect(distance).toBeLessThan(1);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('equals()', () => {
    it('should return true for identical coordinates', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(40.7128, -74.006);
      expect(coords1.equals(coords2)).toBe(true);
    });

    it('should return false for different latitudes', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(40.7129, -74.006);
      expect(coords1.equals(coords2)).toBe(false);
    });

    it('should return false for different longitudes', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(40.7128, -74.007);
      expect(coords1.equals(coords2)).toBe(false);
    });

    it('should return false for completely different coordinates', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(51.5074, -0.1278);
      expect(coords1.equals(coords2)).toBe(false);
    });

    it('should return true for origin coordinates (0, 0)', () => {
      const coords1 = Coordinates.create(0, 0);
      const coords2 = Coordinates.create(0, 0);
      expect(coords1.equals(coords2)).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should return string representation', () => {
      const coords = Coordinates.create(40.7128, -74.006);
      expect(coords.toString()).toBe('40.7128,-74.006');
    });

    it('should handle zero coordinates', () => {
      const coords = Coordinates.create(0, 0);
      expect(coords.toString()).toBe('0,0');
    });

    it('should handle negative coordinates', () => {
      const coords = Coordinates.create(-33.8688, -151.2093);
      expect(coords.toString()).toBe('-33.8688,-151.2093');
    });

    it('should handle max latitude and longitude', () => {
      const coords = Coordinates.create(90, 180);
      expect(coords.toString()).toBe('90,180');
    });
  });

  describe('toObject()', () => {
    it('should return object representation', () => {
      const coords = Coordinates.create(40.7128, -74.006);
      const obj = coords.toObject();
      expect(obj).toEqual({
        latitude: 40.7128,
        longitude: -74.006,
      });
    });

    it('should return defensive copy', () => {
      const coords = Coordinates.create(40.7128, -74.006);
      const obj1 = coords.toObject();
      const obj2 = coords.toObject();
      expect(obj1).not.toBe(obj2);
      expect(obj1).toEqual(obj2);
    });

    it('should have immutable values', () => {
      const coords = Coordinates.create(40.7128, -74.006);
      const obj = coords.toObject();
      obj.latitude = 0;
      obj.longitude = 0;

      expect(coords.getLatitude()).toBe(40.7128);
      expect(coords.getLongitude()).toBe(-74.006);
    });
  });

  describe('Immutability', () => {
    it('should create new instances for same values', () => {
      const coords1 = Coordinates.create(40.7128, -74.006);
      const coords2 = Coordinates.create(40.7128, -74.006);
      expect(coords1).not.toBe(coords2);
      expect(coords1.equals(coords2)).toBe(true);
    });

    it('should have immutable properties', () => {
      const coords = Coordinates.create(40.7128, -74.006);
      expect(coords.getLatitude()).toBe(40.7128);
      expect(coords.getLongitude()).toBe(-74.006);
    });
  });
});
