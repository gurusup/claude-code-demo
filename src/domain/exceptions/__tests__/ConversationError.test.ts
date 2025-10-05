// ABOUTME: Unit tests for ConversationError exception
// ABOUTME: Tests error construction, properties, and inheritance chain

import { describe, it, expect } from 'vitest';
import { ConversationError } from '../ConversationError';

describe('ConversationError', () => {
  describe('Construction', () => {
    it('should create error with message only', () => {
      const error = new ConversationError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConversationError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ConversationError');
    });

    it('should create error with message and conversationId', () => {
      const error = new ConversationError('Conversation error', 'conv-123');

      expect(error.message).toBe('Conversation error');
      expect(error.conversationId).toBe('conv-123');
    });

    it('should have undefined conversationId when not provided', () => {
      const error = new ConversationError('Test error');

      expect(error.conversationId).toBeUndefined();
    });

    it('should accept empty string as conversationId', () => {
      const error = new ConversationError('Test error', '');

      expect(error.conversationId).toBe('');
    });
  });

  describe('Error properties', () => {
    it('should have correct name property', () => {
      const error = new ConversationError('Test');

      expect(error.name).toBe('ConversationError');
    });

    it('should have stack trace', () => {
      const error = new ConversationError('Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConversationError');
    });

    it('should preserve prototype chain', () => {
      const error = new ConversationError('Test');

      expect(Object.getPrototypeOf(error)).toBe(ConversationError.prototype);
    });
  });

  describe('instanceof checks', () => {
    it('should be instance of ConversationError', () => {
      const error = new ConversationError('Test');

      expect(error instanceof ConversationError).toBe(true);
    });

    it('should be instance of Error', () => {
      const error = new ConversationError('Test');

      expect(error instanceof Error).toBe(true);
    });

    it('should work with try-catch', () => {
      expect(() => {
        throw new ConversationError('Test error', 'conv-123');
      }).toThrow(ConversationError);
    });
  });

  describe('Error context', () => {
    it('should capture conversationId for domain context', () => {
      const conversationId = 'conv-abc-123';
      const error = new ConversationError('Cannot add message to archived conversation', conversationId);

      expect(error.conversationId).toBe(conversationId);
      expect(error.message).toContain('archived');
    });

    it('should support UUID conversationId format', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const error = new ConversationError('Test', uuid);

      expect(error.conversationId).toBe(uuid);
    });

    it('should be throwable and catchable with conversationId', () => {
      try {
        throw new ConversationError('Conversation limit exceeded', 'conv-999');
      } catch (error) {
        expect(error).toBeInstanceOf(ConversationError);
        if (error instanceof ConversationError) {
          expect(error.conversationId).toBe('conv-999');
          expect(error.message).toBe('Conversation limit exceeded');
        }
      }
    });
  });

  describe('Common error scenarios', () => {
    it('should represent message limit violation', () => {
      const error = new ConversationError(
        'Cannot add message: conversation has reached maximum of 1000 messages',
        'conv-123'
      );

      expect(error.message).toContain('1000 messages');
      expect(error.conversationId).toBe('conv-123');
    });

    it('should represent archived conversation violation', () => {
      const error = new ConversationError(
        'Cannot add message to archived conversation',
        'conv-456'
      );

      expect(error.message).toContain('archived');
      expect(error.conversationId).toBe('conv-456');
    });

    it('should represent pending tool invocation violation', () => {
      const error = new ConversationError(
        'Cannot add non-tool message while tool invocations are pending',
        'conv-789'
      );

      expect(error.message).toContain('pending');
      expect(error.conversationId).toBe('conv-789');
    });
  });
});
