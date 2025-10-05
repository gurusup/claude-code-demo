// ABOUTME: Unit tests for ToolName value object
// ABOUTME: Tests tool name validation and naming conventions

import { describe, it, expect } from 'vitest';
import { ToolName } from '../ToolName';

describe('ToolName', () => {
  describe('from()', () => {
    describe('Valid tool names', () => {
      it('should create from valid tool name with underscores', () => {
        const name = ToolName.from('get_weather');
        expect(name.getValue()).toBe('get_weather');
      });

      it('should accept names starting with uppercase letter', () => {
        const name = ToolName.from('CalculateSum');
        expect(name.getValue()).toBe('CalculateSum');
      });

      it('should accept names with numbers', () => {
        const name = ToolName.from('tool123');
        expect(name.getValue()).toBe('tool123');
      });

      it('should accept names with mixed case and underscores', () => {
        const name = ToolName.from('Get_Weather_Data');
        expect(name.getValue()).toBe('Get_Weather_Data');
      });

      it('should accept single letter name', () => {
        const name = ToolName.from('a');
        expect(name.getValue()).toBe('a');
      });

      it('should accept name with exactly 100 characters', () => {
        const name100 = 'a' + '1'.repeat(99);
        const name = ToolName.from(name100);
        expect(name.getValue()).toBe(name100);
      });
    });

    describe('Invalid tool names - type validation', () => {
      it('should throw for empty string', () => {
        expect(() => ToolName.from('')).toThrow('non-empty string');
      });

      it('should throw for null', () => {
        expect(() => ToolName.from(null as any)).toThrow('non-empty string');
      });

      it('should throw for undefined', () => {
        expect(() => ToolName.from(undefined as any)).toThrow('non-empty string');
      });

      it('should throw for number', () => {
        expect(() => ToolName.from(123 as any)).toThrow('non-empty string');
      });

      it('should throw for object', () => {
        expect(() => ToolName.from({} as any)).toThrow('non-empty string');
      });
    });

    describe('Invalid tool names - whitespace validation', () => {
      it('should throw for whitespace only', () => {
        expect(() => ToolName.from('   ')).toThrow('empty or whitespace');
      });

      it('should throw for tab characters only', () => {
        expect(() => ToolName.from('\t\t')).toThrow('empty or whitespace');
      });

      it('should throw for newline characters only', () => {
        expect(() => ToolName.from('\n\n')).toThrow('empty or whitespace');
      });
    });

    describe('Invalid tool names - length validation', () => {
      it('should throw for name exceeding 100 characters', () => {
        const longName = 'a'.repeat(101);
        expect(() => ToolName.from(longName)).toThrow('cannot exceed 100 characters');
      });

      it('should throw for name with 200 characters', () => {
        const veryLongName = 'a'.repeat(200);
        expect(() => ToolName.from(veryLongName)).toThrow('cannot exceed 100 characters');
      });
    });

    describe('Invalid tool names - pattern validation', () => {
      it('should throw for name starting with number', () => {
        expect(() => ToolName.from('123tool')).toThrow('must start with a letter');
      });

      it('should throw for name starting with underscore', () => {
        expect(() => ToolName.from('_tool')).toThrow('must start with a letter');
      });

      it('should throw for name with hyphen', () => {
        expect(() => ToolName.from('tool-name')).toThrow('letters, numbers, and underscores');
      });

      it('should throw for name with space', () => {
        expect(() => ToolName.from('tool name')).toThrow('letters, numbers, and underscores');
      });

      it('should throw for name with dot', () => {
        expect(() => ToolName.from('tool.name')).toThrow('letters, numbers, and underscores');
      });

      it('should throw for name with special characters', () => {
        expect(() => ToolName.from('tool@name')).toThrow('letters, numbers, and underscores');
      });

      it('should throw for name with dollar sign', () => {
        expect(() => ToolName.from('$toolName')).toThrow('letters, numbers, and underscores');
      });
    });
  });

  describe('getValue()', () => {
    it('should return the tool name value', () => {
      const name = ToolName.from('testTool');
      expect(name.getValue()).toBe('testTool');
    });

    it('should return exact value including underscores', () => {
      const name = ToolName.from('test_tool_name');
      expect(name.getValue()).toBe('test_tool_name');
    });
  });

  describe('equals()', () => {
    it('should return true for same names', () => {
      const name1 = ToolName.from('get_weather');
      const name2 = ToolName.from('get_weather');
      expect(name1.equals(name2)).toBe(true);
    });

    it('should return false for different names', () => {
      const name1 = ToolName.from('tool1');
      const name2 = ToolName.from('tool2');
      expect(name1.equals(name2)).toBe(false);
    });

    it('should be case-sensitive', () => {
      const name1 = ToolName.from('Tool');
      const name2 = ToolName.from('tool');
      expect(name1.equals(name2)).toBe(false);
    });

    it('should return true for identical complex names', () => {
      const name1 = ToolName.from('Complex_Tool_123');
      const name2 = ToolName.from('Complex_Tool_123');
      expect(name1.equals(name2)).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should return string representation', () => {
      const name = ToolName.from('myTool');
      expect(name.toString()).toBe('myTool');
    });

    it('should match getValue() output', () => {
      const name = ToolName.from('test_tool');
      expect(name.toString()).toBe(name.getValue());
    });
  });

  describe('Immutability', () => {
    it('should create new instances for same value', () => {
      const name1 = ToolName.from('test');
      const name2 = ToolName.from('test');
      expect(name1).not.toBe(name2);
      expect(name1.equals(name2)).toBe(true);
    });

    it('should have immutable value', () => {
      const name = ToolName.from('testTool');
      const value = name.getValue();
      expect(name.getValue()).toBe(value);
    });
  });
});
