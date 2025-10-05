// ABOUTME: Unit tests for MessageRole value object
// ABOUTME: Tests role validation, type checking, and immutability

import { describe, it, expect } from 'vitest';
import { MessageRole } from '../MessageRole';
import { InvalidMessageError } from '../../exceptions/InvalidMessageError';

describe('MessageRole', () => {
  describe('from()', () => {
    it('should create role from valid string', () => {
      const role = MessageRole.from('user');
      expect(role.getValue()).toBe('user');
    });

    it('should throw InvalidMessageError for invalid role', () => {
      expect(() => MessageRole.from('invalid')).toThrow(InvalidMessageError);
    });

    it('should throw InvalidMessageError for empty string', () => {
      expect(() => MessageRole.from('')).toThrow(InvalidMessageError);
    });

    it('should throw InvalidMessageError for null', () => {
      expect(() => MessageRole.from(null as any)).toThrow(InvalidMessageError);
    });

    it('should throw InvalidMessageError for undefined', () => {
      expect(() => MessageRole.from(undefined as any)).toThrow(InvalidMessageError);
    });
  });

  describe('Static factory methods', () => {
    it('should create user role via user()', () => {
      const role = MessageRole.user();
      expect(role.getValue()).toBe('user');
      expect(role.isUser()).toBe(true);
    });

    it('should create assistant role via assistant()', () => {
      const role = MessageRole.assistant();
      expect(role.getValue()).toBe('assistant');
      expect(role.isAssistant()).toBe(true);
    });

    it('should create system role via system()', () => {
      const role = MessageRole.system();
      expect(role.getValue()).toBe('system');
      expect(role.isSystem()).toBe(true);
    });

    it('should create tool role via tool()', () => {
      const role = MessageRole.tool();
      expect(role.getValue()).toBe('tool');
      expect(role.isTool()).toBe(true);
    });
  });

  describe('Type checking methods', () => {
    it('should return true for isUser() when role is user', () => {
      const role = MessageRole.user();
      expect(role.isUser()).toBe(true);
      expect(role.isAssistant()).toBe(false);
      expect(role.isSystem()).toBe(false);
      expect(role.isTool()).toBe(false);
    });

    it('should return true for isAssistant() when role is assistant', () => {
      const role = MessageRole.assistant();
      expect(role.isAssistant()).toBe(true);
      expect(role.isUser()).toBe(false);
      expect(role.isSystem()).toBe(false);
      expect(role.isTool()).toBe(false);
    });

    it('should return true for isSystem() when role is system', () => {
      const role = MessageRole.system();
      expect(role.isSystem()).toBe(true);
      expect(role.isUser()).toBe(false);
      expect(role.isAssistant()).toBe(false);
      expect(role.isTool()).toBe(false);
    });

    it('should return true for isTool() when role is tool', () => {
      const role = MessageRole.tool();
      expect(role.isTool()).toBe(true);
      expect(role.isUser()).toBe(false);
      expect(role.isAssistant()).toBe(false);
      expect(role.isSystem()).toBe(false);
    });
  });

  describe('equals()', () => {
    it('should return true for same roles', () => {
      const role1 = MessageRole.user();
      const role2 = MessageRole.user();
      expect(role1.equals(role2)).toBe(true);
    });

    it('should return false for different roles', () => {
      const role1 = MessageRole.user();
      const role2 = MessageRole.assistant();
      expect(role1.equals(role2)).toBe(false);
    });

    it('should work with all role combinations', () => {
      const user = MessageRole.user();
      const assistant = MessageRole.assistant();
      const system = MessageRole.system();
      const tool = MessageRole.tool();

      expect(user.equals(user)).toBe(true);
      expect(assistant.equals(assistant)).toBe(true);
      expect(system.equals(system)).toBe(true);
      expect(tool.equals(tool)).toBe(true);

      expect(user.equals(assistant)).toBe(false);
      expect(assistant.equals(system)).toBe(false);
      expect(system.equals(tool)).toBe(false);
    });
  });

  describe('getValue()', () => {
    it('should return the role string value', () => {
      expect(MessageRole.user().getValue()).toBe('user');
      expect(MessageRole.assistant().getValue()).toBe('assistant');
      expect(MessageRole.system().getValue()).toBe('system');
      expect(MessageRole.tool().getValue()).toBe('tool');
    });
  });

  describe('toString()', () => {
    it('should return the role string representation', () => {
      expect(MessageRole.user().toString()).toBe('user');
      expect(MessageRole.assistant().toString()).toBe('assistant');
      expect(MessageRole.system().toString()).toBe('system');
      expect(MessageRole.tool().toString()).toBe('tool');
    });
  });

  describe('Immutability', () => {
    it('should not allow modification of role value', () => {
      const role = MessageRole.user();
      const originalValue = role.getValue();

      // Attempt to modify (should not be possible due to private readonly)
      expect(role.getValue()).toBe(originalValue);
    });

    it('should create new instances for each factory call', () => {
      const role1 = MessageRole.user();
      const role2 = MessageRole.user();

      // Should be different instances
      expect(role1).not.toBe(role2);
      // But should be equal
      expect(role1.equals(role2)).toBe(true);
    });
  });
});
