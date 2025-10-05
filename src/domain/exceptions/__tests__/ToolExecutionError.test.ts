// ABOUTME: Unit tests for ToolExecutionError exception
// ABOUTME: Tests tool execution error with cause wrapping and factory method

import { describe, it, expect } from 'vitest';
import { ToolExecutionError } from '../ToolExecutionError';

describe('ToolExecutionError', () => {
  describe('Construction', () => {
    it('should create error with message only', () => {
      const error = new ToolExecutionError('Tool execution failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.message).toBe('Tool execution failed');
      expect(error.name).toBe('ToolExecutionError');
    });

    it('should create error with message and toolName', () => {
      const error = new ToolExecutionError('Execution failed', 'get_weather');

      expect(error.message).toBe('Execution failed');
      expect(error.toolName).toBe('get_weather');
    });

    it('should create error with message, toolName, and cause', () => {
      const cause = new Error('Network timeout');
      const error = new ToolExecutionError('Tool failed', 'get_weather', cause);

      expect(error.message).toBe('Tool failed');
      expect(error.toolName).toBe('get_weather');
      expect(error.cause).toBe(cause);
    });

    it('should have undefined toolName when not provided', () => {
      const error = new ToolExecutionError('Test error');

      expect(error.toolName).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should accept empty string as toolName', () => {
      const error = new ToolExecutionError('Test error', '');

      expect(error.toolName).toBe('');
    });
  });

  describe('Error properties', () => {
    it('should have correct name property', () => {
      const error = new ToolExecutionError('Test');

      expect(error.name).toBe('ToolExecutionError');
    });

    it('should have stack trace', () => {
      const error = new ToolExecutionError('Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ToolExecutionError');
    });

    it('should preserve prototype chain', () => {
      const error = new ToolExecutionError('Test');

      expect(Object.getPrototypeOf(error)).toBe(ToolExecutionError.prototype);
    });
  });

  describe('fromCause() factory method', () => {
    it('should create error from cause', () => {
      const cause = new Error('API rate limit exceeded');
      const error = ToolExecutionError.fromCause('get_weather', cause);

      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.toolName).toBe('get_weather');
      expect(error.cause).toBe(cause);
    });

    it('should format message with tool name and cause message', () => {
      const cause = new Error('Connection timeout');
      const error = ToolExecutionError.fromCause('fetch_data', cause);

      expect(error.message).toBe("Tool 'fetch_data' execution failed: Connection timeout");
    });

    it('should handle cause with empty message', () => {
      const cause = new Error('');
      const error = ToolExecutionError.fromCause('myTool', cause);

      expect(error.message).toBe("Tool 'myTool' execution failed: ");
    });

    it('should preserve original cause error', () => {
      const originalError = new TypeError('Invalid argument');
      const error = ToolExecutionError.fromCause('validateInput', originalError);

      expect(error.cause).toBe(originalError);
      expect(error.cause).toBeInstanceOf(TypeError);
    });

    it('should handle complex tool names', () => {
      const cause = new Error('Failed');
      const error = ToolExecutionError.fromCause('complex_tool_name_123', cause);

      expect(error.toolName).toBe('complex_tool_name_123');
      expect(error.message).toContain('complex_tool_name_123');
    });
  });

  describe('instanceof checks', () => {
    it('should be instance of ToolExecutionError', () => {
      const error = new ToolExecutionError('Test');

      expect(error instanceof ToolExecutionError).toBe(true);
    });

    it('should be instance of Error', () => {
      const error = new ToolExecutionError('Test');

      expect(error instanceof Error).toBe(true);
    });

    it('should work with try-catch', () => {
      expect(() => {
        throw new ToolExecutionError('Tool failed', 'get_weather');
      }).toThrow(ToolExecutionError);
    });

    it('should work with fromCause in try-catch', () => {
      expect(() => {
        const cause = new Error('Network error');
        throw ToolExecutionError.fromCause('apiCall', cause);
      }).toThrow(ToolExecutionError);
    });
  });

  describe('Tool execution context', () => {
    it('should capture tool name for debugging', () => {
      const error = new ToolExecutionError('Invalid arguments', 'calculateSum');

      expect(error.toolName).toBe('calculateSum');
    });

    it('should capture cause error for debugging', () => {
      const networkError = new Error('ECONNREFUSED');
      const error = new ToolExecutionError('API call failed', 'fetchData', networkError);

      expect(error.cause).toBe(networkError);
      expect(error.cause?.message).toBe('ECONNREFUSED');
    });

    it('should be throwable and catchable with all context', () => {
      try {
        const cause = new Error('Timeout');
        throw new ToolExecutionError('Tool timed out', 'longRunningTask', cause);
      } catch (error) {
        expect(error).toBeInstanceOf(ToolExecutionError);
        if (error instanceof ToolExecutionError) {
          expect(error.toolName).toBe('longRunningTask');
          expect(error.cause?.message).toBe('Timeout');
        }
      }
    });
  });

  describe('Common tool execution scenarios', () => {
    it('should represent invalid arguments error', () => {
      const error = new ToolExecutionError(
        'Invalid arguments provided to tool',
        'get_weather'
      );

      expect(error.message).toContain('Invalid arguments');
      expect(error.toolName).toBe('get_weather');
    });

    it('should represent timeout error with cause', () => {
      const timeoutError = new Error('Request timeout after 30s');
      const error = ToolExecutionError.fromCause('api_call', timeoutError);

      expect(error.message).toContain('timeout');
      expect(error.toolName).toBe('api_call');
    });

    it('should represent state transition error', () => {
      const error = new ToolExecutionError(
        'Cannot execute tool in COMPLETED state',
        'processTool'
      );

      expect(error.message).toContain('COMPLETED state');
      expect(error.toolName).toBe('processTool');
    });

    it('should wrap API errors', () => {
      const apiError = new Error('API returned 429 Too Many Requests');
      const error = ToolExecutionError.fromCause('weather_api', apiError);

      expect(error.message).toContain('429');
      expect(error.cause).toBe(apiError);
    });
  });

  describe('Cause error chain', () => {
    it('should preserve cause error type', () => {
      const typeError = new TypeError('Expected string, got number');
      const error = new ToolExecutionError('Validation failed', 'validate', typeError);

      expect(error.cause).toBeInstanceOf(TypeError);
    });

    it('should allow accessing cause properties', () => {
      const cause = new Error('Original error');
      cause.stack = 'Original stack trace';
      const error = new ToolExecutionError('Wrapped error', 'tool', cause);

      expect(error.cause?.stack).toBe('Original stack trace');
    });

    it('should support nested error wrapping', () => {
      const rootCause = new Error('Root cause');
      const middleError = new ToolExecutionError('Middle error', 'tool1', rootCause);
      const topError = new ToolExecutionError('Top error', 'tool2', middleError);

      expect(topError.cause).toBe(middleError);
      if (topError.cause instanceof ToolExecutionError) {
        expect(topError.cause.cause).toBe(rootCause);
      }
    });
  });

  describe('Error differentiation', () => {
    it('should be different from base Error', () => {
      const toolError = new ToolExecutionError('Test');
      const baseError = new Error('Test');

      expect(toolError instanceof ToolExecutionError).toBe(true);
      expect(baseError instanceof ToolExecutionError).toBe(false);
    });

    it('should maintain type information in catch blocks', () => {
      try {
        const cause = new Error('Test cause');
        throw ToolExecutionError.fromCause('testTool', cause);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ToolExecutionError);

        if (error instanceof ToolExecutionError) {
          expect(error.name).toBe('ToolExecutionError');
          expect(error.toolName).toBe('testTool');
          expect(error.cause?.message).toBe('Test cause');
        }
      }
    });
  });
});
