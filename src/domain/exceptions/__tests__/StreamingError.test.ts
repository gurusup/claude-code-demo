// ABOUTME: Unit tests for StreamingError exception
// ABOUTME: Tests streaming error construction with optional state context

import { describe, it, expect } from 'vitest';
import { StreamingError } from '../StreamingError';

describe('StreamingError', () => {
  describe('Construction', () => {
    it('should create error with message only', () => {
      const error = new StreamingError('Stream connection failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StreamingError);
      expect(error.message).toBe('Stream connection failed');
      expect(error.name).toBe('StreamingError');
    });

    it('should create error with message and stream state', () => {
      const error = new StreamingError('Stream error', 'BUFFERING');

      expect(error.message).toBe('Stream error');
      expect(error.streamState).toBe('BUFFERING');
    });

    it('should have undefined streamState when not provided', () => {
      const error = new StreamingError('Test error');

      expect(error.streamState).toBeUndefined();
    });

    it('should accept empty string as streamState', () => {
      const error = new StreamingError('Test error', '');

      expect(error.streamState).toBe('');
    });
  });

  describe('Error properties', () => {
    it('should have correct name property', () => {
      const error = new StreamingError('Test');

      expect(error.name).toBe('StreamingError');
    });

    it('should have stack trace', () => {
      const error = new StreamingError('Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('StreamingError');
    });

    it('should preserve prototype chain', () => {
      const error = new StreamingError('Test');

      expect(Object.getPrototypeOf(error)).toBe(StreamingError.prototype);
    });
  });

  describe('instanceof checks', () => {
    it('should be instance of StreamingError', () => {
      const error = new StreamingError('Test');

      expect(error instanceof StreamingError).toBe(true);
    });

    it('should be instance of Error', () => {
      const error = new StreamingError('Test');

      expect(error instanceof Error).toBe(true);
    });

    it('should work with try-catch', () => {
      expect(() => {
        throw new StreamingError('Stream failed', 'ERROR');
      }).toThrow(StreamingError);
    });
  });

  describe('Stream state context', () => {
    it('should capture IDLE state', () => {
      const error = new StreamingError('Cannot start stream', 'IDLE');

      expect(error.streamState).toBe('IDLE');
    });

    it('should capture STREAMING state', () => {
      const error = new StreamingError('Stream interrupted', 'STREAMING');

      expect(error.streamState).toBe('STREAMING');
    });

    it('should capture ERROR state', () => {
      const error = new StreamingError('Stream encountered error', 'ERROR');

      expect(error.streamState).toBe('ERROR');
    });

    it('should capture COMPLETED state', () => {
      const error = new StreamingError('Cannot resume completed stream', 'COMPLETED');

      expect(error.streamState).toBe('COMPLETED');
    });

    it('should be throwable and catchable with streamState', () => {
      try {
        throw new StreamingError('Buffer overflow', 'BUFFERING');
      } catch (error) {
        expect(error).toBeInstanceOf(StreamingError);
        if (error instanceof StreamingError) {
          expect(error.streamState).toBe('BUFFERING');
          expect(error.message).toBe('Buffer overflow');
        }
      }
    });
  });

  describe('Common streaming scenarios', () => {
    it('should represent connection failure', () => {
      const error = new StreamingError(
        'Failed to establish streaming connection',
        'CONNECTING'
      );

      expect(error.message).toContain('connection');
      expect(error.streamState).toBe('CONNECTING');
    });

    it('should represent interrupted stream', () => {
      const error = new StreamingError(
        'Stream interrupted by client disconnect',
        'STREAMING'
      );

      expect(error.message).toContain('interrupted');
      expect(error.streamState).toBe('STREAMING');
    });

    it('should represent invalid state transition', () => {
      const error = new StreamingError(
        'Cannot transition from COMPLETED to STREAMING',
        'COMPLETED'
      );

      expect(error.message).toContain('transition');
      expect(error.streamState).toBe('COMPLETED');
    });

    it('should represent buffer errors', () => {
      const error = new StreamingError(
        'Stream buffer capacity exceeded',
        'BUFFERING'
      );

      expect(error.message).toContain('buffer');
      expect(error.streamState).toBe('BUFFERING');
    });
  });

  describe('Error differentiation', () => {
    it('should be different from base Error', () => {
      const streamingError = new StreamingError('Test');
      const baseError = new Error('Test');

      expect(streamingError instanceof StreamingError).toBe(true);
      expect(baseError instanceof StreamingError).toBe(false);
    });

    it('should maintain type information in catch blocks', () => {
      try {
        throw new StreamingError('Type check', 'IDLE');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(StreamingError);

        if (error instanceof StreamingError) {
          expect(error.name).toBe('StreamingError');
          expect(error.streamState).toBe('IDLE');
        }
      }
    });
  });
});
