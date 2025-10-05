// ABOUTME: Unit tests for ToolInvocation entity
// ABOUTME: Tests state machine transitions, validation, and immutability

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolInvocation, ToolInvocationState } from '../ToolInvocation';
import { ToolName } from '../../value-objects/ToolName';
import { ToolExecutionError } from '../../exceptions/ToolExecutionError';
import { ToolInvocationBuilder } from '../../__test-helpers__/builders/ToolInvocationBuilder';

describe('ToolInvocation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create()', () => {
    it('should create tool invocation with valid parameters', () => {
      const toolName = ToolName.from('get_weather');
      const args = { location: 'London' };

      const invocation = ToolInvocation.create('call_123', toolName, args);

      expect(invocation.getCallId()).toBe('call_123');
      expect(invocation.getToolName().equals(toolName)).toBe(true);
      expect(invocation.getArgs()).toEqual(args);
      expect(invocation.getState()).toBe(ToolInvocationState.PENDING);
    });

    it('should create invocation in PENDING state', () => {
      const invocation = ToolInvocation.create(
        'call_1',
        ToolName.from('test'),
        {}
      );

      expect(invocation.isPending()).toBe(true);
      expect(invocation.isExecuting()).toBe(false);
      expect(invocation.isCompleted()).toBe(false);
      expect(invocation.isFailed()).toBe(false);
    });

    it('should throw for empty callId', () => {
      expect(() =>
        ToolInvocation.create('', ToolName.from('test'), {})
      ).toThrow(ToolExecutionError);
    });

    it('should throw for null callId', () => {
      expect(() =>
        ToolInvocation.create(null as any, ToolName.from('test'), {})
      ).toThrow('non-empty string');
    });

    it('should throw for non-string callId', () => {
      expect(() =>
        ToolInvocation.create(123 as any, ToolName.from('test'), {})
      ).toThrow('non-empty string');
    });

    it('should freeze args to prevent mutation', () => {
      const args = { location: 'Paris' };
      const invocation = ToolInvocation.create('call_1', ToolName.from('test'), args);

      expect(() => {
        const retrievedArgs = invocation.getArgs() as any;
        retrievedArgs.location = 'Berlin';
      }).not.toThrow();

      // Original args in invocation should not change
      expect(invocation.getArgs()).toEqual({ location: 'Paris' });
    });
  });

  describe('State machine: PENDING → EXECUTING', () => {
    it('should transition from PENDING to EXECUTING', () => {
      const invocation = new ToolInvocationBuilder().pending().build();

      invocation.markAsExecuting();

      expect(invocation.isExecuting()).toBe(true);
      expect(invocation.isPending()).toBe(false);
    });

    it('should throw when marking EXECUTING as executing', () => {
      const invocation = new ToolInvocationBuilder().executing().build();

      expect(() => invocation.markAsExecuting()).toThrow(ToolExecutionError);
      expect(() => invocation.markAsExecuting()).toThrow('executing state');
    });

    it('should throw when marking COMPLETED as executing', () => {
      const invocation = new ToolInvocationBuilder().completed().build();

      expect(() => invocation.markAsExecuting()).toThrow(ToolExecutionError);
    });

    it('should throw when marking FAILED as executing', () => {
      const invocation = new ToolInvocationBuilder().failed().build();

      expect(() => invocation.markAsExecuting()).toThrow(ToolExecutionError);
    });
  });

  describe('State machine: EXECUTING → COMPLETED', () => {
    it('should transition from EXECUTING to COMPLETED with result', () => {
      const invocation = new ToolInvocationBuilder().executing().build();
      const result = { temperature: 22, condition: 'sunny' };

      invocation.complete(result);

      expect(invocation.isCompleted()).toBe(true);
      expect(invocation.getResult()).toEqual(result);
      expect(invocation.getCompletedAt()).toBeDefined();
    });

    it('should throw when completing from PENDING', () => {
      const invocation = new ToolInvocationBuilder().pending().build();

      expect(() => invocation.complete({ data: 'test' })).toThrow(ToolExecutionError);
      expect(() => invocation.complete({ data: 'test' })).toThrow('executing state');
    });

    it('should throw when completing already COMPLETED', () => {
      const invocation = new ToolInvocationBuilder().completed({ first: 'result' }).build();

      expect(() => invocation.complete({ second: 'result' })).toThrow(ToolExecutionError);
    });

    it('should throw when completing already FAILED', () => {
      const invocation = new ToolInvocationBuilder().failed().build();

      expect(() => invocation.complete({ data: 'test' })).toThrow(ToolExecutionError);
    });

    it('should accept undefined as result', () => {
      const invocation = new ToolInvocationBuilder().executing().build();

      invocation.complete(undefined);

      expect(invocation.isCompleted()).toBe(true);
      expect(invocation.getResult()).toBeUndefined();
    });

    it('should accept null as result', () => {
      const invocation = new ToolInvocationBuilder().executing().build();

      invocation.complete(null);

      expect(invocation.isCompleted()).toBe(true);
      expect(invocation.getResult()).toBeNull();
    });
  });

  describe('State machine: EXECUTING → FAILED', () => {
    it('should transition from EXECUTING to FAILED with error', () => {
      const invocation = new ToolInvocationBuilder().executing().build();
      const error = new Error('API timeout');

      invocation.fail(error);

      expect(invocation.isFailed()).toBe(true);
      expect(invocation.getError()).toBe(error);
      expect(invocation.getCompletedAt()).toBeDefined();
    });

    it('should throw when failing from PENDING', () => {
      const invocation = new ToolInvocationBuilder().pending().build();

      expect(() => invocation.fail(new Error('test'))).toThrow(ToolExecutionError);
      expect(() => invocation.fail(new Error('test'))).toThrow('executing state');
    });

    it('should throw when failing already COMPLETED', () => {
      const invocation = new ToolInvocationBuilder().completed().build();

      expect(() => invocation.fail(new Error('test'))).toThrow(ToolExecutionError);
    });

    it('should throw when failing already FAILED', () => {
      const invocation = new ToolInvocationBuilder().failed(new Error('first')).build();

      expect(() => invocation.fail(new Error('second'))).toThrow(ToolExecutionError);
    });
  });

  describe('Query methods', () => {
    it('should correctly identify PENDING state', () => {
      const invocation = new ToolInvocationBuilder().pending().build();

      expect(invocation.isPending()).toBe(true);
      expect(invocation.isExecuting()).toBe(false);
      expect(invocation.isCompleted()).toBe(false);
      expect(invocation.isFailed()).toBe(false);
      expect(invocation.isFinished()).toBe(false);
    });

    it('should correctly identify EXECUTING state', () => {
      const invocation = new ToolInvocationBuilder().executing().build();

      expect(invocation.isPending()).toBe(false);
      expect(invocation.isExecuting()).toBe(true);
      expect(invocation.isCompleted()).toBe(false);
      expect(invocation.isFailed()).toBe(false);
      expect(invocation.isFinished()).toBe(false);
    });

    it('should correctly identify COMPLETED state', () => {
      const invocation = new ToolInvocationBuilder().completed().build();

      expect(invocation.isPending()).toBe(false);
      expect(invocation.isExecuting()).toBe(false);
      expect(invocation.isCompleted()).toBe(true);
      expect(invocation.isFailed()).toBe(false);
      expect(invocation.isFinished()).toBe(true);
    });

    it('should correctly identify FAILED state', () => {
      const invocation = new ToolInvocationBuilder().failed().build();

      expect(invocation.isPending()).toBe(false);
      expect(invocation.isExecuting()).toBe(false);
      expect(invocation.isCompleted()).toBe(false);
      expect(invocation.isFailed()).toBe(true);
      expect(invocation.isFinished()).toBe(true);
    });
  });

  describe('getExecutionTime()', () => {
    it('should return undefined for PENDING invocation', () => {
      const invocation = new ToolInvocationBuilder().pending().build();

      expect(invocation.getExecutionTime()).toBeUndefined();
    });

    it('should return undefined for EXECUTING invocation', () => {
      const invocation = new ToolInvocationBuilder().executing().build();

      expect(invocation.getExecutionTime()).toBeUndefined();
    });

    it('should return execution time for COMPLETED invocation', () => {
      vi.useFakeTimers();
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(startTime);

      const invocation = ToolInvocation.create('call_1', ToolName.from('test'), {});
      invocation.markAsExecuting();

      vi.setSystemTime(new Date('2024-01-01T10:00:05Z')); // 5 seconds later
      invocation.complete({ data: 'result' });

      expect(invocation.getExecutionTime()).toBe(5000); // 5000ms
    });

    it('should return execution time for FAILED invocation', () => {
      vi.useFakeTimers();
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(startTime);

      const invocation = ToolInvocation.create('call_1', ToolName.from('test'), {});
      invocation.markAsExecuting();

      vi.setSystemTime(new Date('2024-01-01T10:00:03Z')); // 3 seconds later
      invocation.fail(new Error('timeout'));

      expect(invocation.getExecutionTime()).toBe(3000); // 3000ms
    });
  });

  describe('getArgs()', () => {
    it('should return defensive copy of args', () => {
      const invocation = new ToolInvocationBuilder()
        .withArgs({ city: 'Tokyo', units: 'metric' })
        .build();

      const args1 = invocation.getArgs();
      const args2 = invocation.getArgs();

      expect(args1).toEqual(args2);
      expect(args1).not.toBe(args2); // Different objects
    });

    it('should prevent mutation through returned args', () => {
      const invocation = new ToolInvocationBuilder()
        .withArgs({ value: 100 })
        .build();

      const args = invocation.getArgs() as any;
      args.value = 200;

      expect(invocation.getArgs()).toEqual({ value: 100 });
    });
  });

  describe('toObject()', () => {
    it('should convert PENDING invocation to object', () => {
      const invocation = new ToolInvocationBuilder()
        .withCallId('call_abc')
        .withToolName('calculate')
        .withArgs({ x: 10, y: 20 })
        .pending()
        .build();

      const obj = invocation.toObject();

      expect(obj).toEqual({
        callId: 'call_abc',
        toolName: 'calculate',
        args: { x: 10, y: 20 },
        state: ToolInvocationState.PENDING,
        result: undefined,
        error: undefined,
      });
    });

    it('should convert COMPLETED invocation to object', () => {
      const invocation = new ToolInvocationBuilder()
        .withCallId('call_123')
        .withToolName('add')
        .completed({ sum: 30 })
        .build();

      const obj = invocation.toObject();

      expect(obj.state).toBe(ToolInvocationState.COMPLETED);
      expect(obj.result).toEqual({ sum: 30 });
    });

    it('should convert FAILED invocation to object with error message', () => {
      const error = new Error('Network timeout');
      const invocation = new ToolInvocationBuilder()
        .failed(error)
        .build();

      const obj = invocation.toObject();

      expect(obj.state).toBe(ToolInvocationState.FAILED);
      expect(obj.error).toBe('Network timeout');
    });
  });

  describe('Immutability', () => {
    it('should have immutable callId', () => {
      const invocation = new ToolInvocationBuilder().withCallId('call_original').build();

      expect(invocation.getCallId()).toBe('call_original');
      // callId is readonly, cannot be changed
    });

    it('should have immutable toolName', () => {
      const toolName = ToolName.from('original_tool');
      const invocation = ToolInvocation.create('call_1', toolName, {});

      expect(invocation.getToolName()).toBe(toolName);
    });

    it('should have immutable createdAt', () => {
      const invocation = new ToolInvocationBuilder().build();
      const createdAt = invocation.getCreatedAt();

      expect(invocation.getCreatedAt()).toBe(createdAt);
    });
  });
});
