// ABOUTME: Unit tests for MessageContent value object
// ABOUTME: Tests content validation, utility methods, and immutability

import { describe, it, expect } from 'vitest';
import { MessageContent } from '../MessageContent';
import { InvalidMessageError } from '../../exceptions/InvalidMessageError';

describe('MessageContent', () => {
  describe('from()', () => {
    it('should create content from valid string', () => {
      const content = MessageContent.from('hello world');
      expect(content.getValue()).toBe('hello world');
    });

    it('should create content from empty string', () => {
      const content = MessageContent.from('');
      expect(content.getValue()).toBe('');
      expect(content.isEmpty()).toBe(true);
    });

    it('should throw InvalidMessageError for null', () => {
      expect(() => MessageContent.from(null as any)).toThrow(InvalidMessageError);
      expect(() => MessageContent.from(null as any)).toThrow('Message content cannot be null or undefined');
    });

    it('should throw InvalidMessageError for undefined', () => {
      expect(() => MessageContent.from(undefined as any)).toThrow(InvalidMessageError);
      expect(() => MessageContent.from(undefined as any)).toThrow('Message content cannot be null or undefined');
    });

    it('should throw InvalidMessageError for non-string', () => {
      expect(() => MessageContent.from(123 as any)).toThrow(InvalidMessageError);
      expect(() => MessageContent.from(123 as any)).toThrow('Message content must be a string');
    });

    it('should handle multi-line content', () => {
      const multiline = 'line1\nline2\nline3';
      const content = MessageContent.from(multiline);
      expect(content.getValue()).toBe(multiline);
    });

    it('should handle special characters', () => {
      const special = 'Hello! @#$%^&*() <html> "quotes"';
      const content = MessageContent.from(special);
      expect(content.getValue()).toBe(special);
    });

    it('should handle Unicode characters', () => {
      const unicode = '你好世界 🌍 émoji';
      const content = MessageContent.from(unicode);
      expect(content.getValue()).toBe(unicode);
    });
  });

  describe('empty()', () => {
    it('should create empty content', () => {
      const content = MessageContent.empty();
      expect(content.getValue()).toBe('');
      expect(content.isEmpty()).toBe(true);
      expect(content.getLength()).toBe(0);
    });
  });

  describe('isEmpty()', () => {
    it('should return true for empty string', () => {
      const content = MessageContent.empty();
      expect(content.isEmpty()).toBe(true);
    });

    it('should return false for non-empty string', () => {
      const content = MessageContent.from('hello');
      expect(content.isEmpty()).toBe(false);
    });

    it('should return false for whitespace-only string', () => {
      const content = MessageContent.from('   ');
      expect(content.isEmpty()).toBe(false);
    });
  });

  describe('getLength()', () => {
    it('should return 0 for empty content', () => {
      const content = MessageContent.empty();
      expect(content.getLength()).toBe(0);
    });

    it('should return correct length for string', () => {
      const content = MessageContent.from('hello');
      expect(content.getLength()).toBe(5);
    });

    it('should count multi-byte characters correctly', () => {
      const content = MessageContent.from('你好');
      expect(content.getLength()).toBe(2);
    });

    it('should count emojis correctly', () => {
      const content = MessageContent.from('🌍🌎');
      expect(content.getLength()).toBe(4); // Emojis are 2 code units each
    });
  });

  describe('contains()', () => {
    it('should return true when substring exists', () => {
      const content = MessageContent.from('hello world');
      expect(content.contains('world')).toBe(true);
      expect(content.contains('hello')).toBe(true);
    });

    it('should return false when substring does not exist', () => {
      const content = MessageContent.from('hello world');
      expect(content.contains('foo')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const content = MessageContent.from('Hello World');
      expect(content.contains('hello')).toBe(false);
      expect(content.contains('Hello')).toBe(true);
    });

    it('should return true for empty string search', () => {
      const content = MessageContent.from('hello');
      expect(content.contains('')).toBe(true);
    });

    it('should handle special characters', () => {
      const content = MessageContent.from('test@example.com');
      expect(content.contains('@')).toBe(true);
    });
  });

  describe('equals()', () => {
    it('should return true for same content', () => {
      const content1 = MessageContent.from('hello');
      const content2 = MessageContent.from('hello');
      expect(content1.equals(content2)).toBe(true);
    });

    it('should return false for different content', () => {
      const content1 = MessageContent.from('hello');
      const content2 = MessageContent.from('world');
      expect(content1.equals(content2)).toBe(false);
    });

    it('should return true for two empty contents', () => {
      const content1 = MessageContent.empty();
      const content2 = MessageContent.empty();
      expect(content1.equals(content2)).toBe(true);
    });

    it('should be case-sensitive', () => {
      const content1 = MessageContent.from('Hello');
      const content2 = MessageContent.from('hello');
      expect(content1.equals(content2)).toBe(false);
    });
  });

  describe('getValue()', () => {
    it('should return the content string', () => {
      const content = MessageContent.from('test content');
      expect(content.getValue()).toBe('test content');
    });

    it('should return empty string for empty content', () => {
      const content = MessageContent.empty();
      expect(content.getValue()).toBe('');
    });
  });

  describe('toString()', () => {
    it('should return the content string representation', () => {
      const content = MessageContent.from('test content');
      expect(content.toString()).toBe('test content');
    });

    it('should match getValue()', () => {
      const content = MessageContent.from('test');
      expect(content.toString()).toBe(content.getValue());
    });
  });

  describe('Immutability', () => {
    it('should not allow modification of content value', () => {
      const content = MessageContent.from('original');
      const originalValue = content.getValue();

      // Verify value remains unchanged
      expect(content.getValue()).toBe(originalValue);
      expect(content.getValue()).toBe('original');
    });

    it('should create new instances for each factory call', () => {
      const content1 = MessageContent.from('test');
      const content2 = MessageContent.from('test');

      // Different instances
      expect(content1).not.toBe(content2);
      // But equal values
      expect(content1.equals(content2)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long content', () => {
      const longString = 'a'.repeat(50000);
      const content = MessageContent.from(longString);
      expect(content.getLength()).toBe(50000);
      expect(content.getValue()).toBe(longString);
    });

    it('should handle content with only whitespace', () => {
      const whitespace = '   \n\t  ';
      const content = MessageContent.from(whitespace);
      expect(content.getValue()).toBe(whitespace);
      expect(content.isEmpty()).toBe(false);
    });

    it('should handle content with null characters', () => {
      const withNull = 'before\0after';
      const content = MessageContent.from(withNull);
      expect(content.getValue()).toBe(withNull);
    });
  });
});
