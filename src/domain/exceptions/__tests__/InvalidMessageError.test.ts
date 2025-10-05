// ABOUTME: Unit tests for InvalidMessageError exception
// ABOUTME: Tests message validation error construction and inheritance

import { describe, it, expect } from 'vitest';
import { InvalidMessageError } from '../InvalidMessageError';

describe('InvalidMessageError', () => {
  describe('Construction', () => {
    it('should create error with message', () => {
      const error = new InvalidMessageError('Invalid message content');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InvalidMessageError);
      expect(error.message).toBe('Invalid message content');
      expect(error.name).toBe('InvalidMessageError');
    });

    it('should accept empty message', () => {
      const error = new InvalidMessageError('');

      expect(error.message).toBe('');
    });

    it('should accept long error messages', () => {
      const longMessage = 'Invalid message: '.repeat(50);
      const error = new InvalidMessageError(longMessage);

      expect(error.message).toBe(longMessage);
    });
  });

  describe('Error properties', () => {
    it('should have correct name property', () => {
      const error = new InvalidMessageError('Test');

      expect(error.name).toBe('InvalidMessageError');
    });

    it('should have stack trace', () => {
      const error = new InvalidMessageError('Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('InvalidMessageError');
    });

    it('should preserve prototype chain', () => {
      const error = new InvalidMessageError('Test');

      expect(Object.getPrototypeOf(error)).toBe(InvalidMessageError.prototype);
    });
  });

  describe('instanceof checks', () => {
    it('should be instance of InvalidMessageError', () => {
      const error = new InvalidMessageError('Test');

      expect(error instanceof InvalidMessageError).toBe(true);
    });

    it('should be instance of Error', () => {
      const error = new InvalidMessageError('Test');

      expect(error instanceof Error).toBe(true);
    });

    it('should work with try-catch', () => {
      expect(() => {
        throw new InvalidMessageError('Invalid role');
      }).toThrow(InvalidMessageError);
    });
  });

  describe('Common validation scenarios', () => {
    it('should represent invalid role error', () => {
      const error = new InvalidMessageError('Invalid message role: invalid_role');

      expect(error.message).toContain('Invalid message role');
    });

    it('should represent empty content error', () => {
      const error = new InvalidMessageError('Message content cannot be empty');

      expect(error.message).toContain('cannot be empty');
    });

    it('should represent role sequence error', () => {
      const error = new InvalidMessageError('Assistant message cannot follow another assistant message');

      expect(error.message).toContain('cannot follow');
    });

    it('should represent tool invocation error', () => {
      const error = new InvalidMessageError('Only assistant messages can have tool invocations');

      expect(error.message).toContain('Only assistant messages');
    });

    it('should be throwable and catchable', () => {
      try {
        throw new InvalidMessageError('Tool message must have non-empty content');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidMessageError);
        if (error instanceof InvalidMessageError) {
          expect(error.message).toContain('Tool message');
        }
      }
    });
  });

  describe('Error differentiation', () => {
    it('should be different from base Error', () => {
      const invalidMessageError = new InvalidMessageError('Test');
      const baseError = new Error('Test');

      expect(invalidMessageError instanceof InvalidMessageError).toBe(true);
      expect(baseError instanceof InvalidMessageError).toBe(false);
    });

    it('should maintain type information in catch blocks', () => {
      try {
        throw new InvalidMessageError('Type check test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidMessageError);

        if (error instanceof InvalidMessageError) {
          expect(error.name).toBe('InvalidMessageError');
        }
      }
    });
  });
});
