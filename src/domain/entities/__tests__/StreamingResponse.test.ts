// ABOUTME: Unit tests for StreamingResponse entity
// ABOUTME: Tests streaming state machine, chunk management, and lifecycle

import { describe, it, expect, vi, afterEach } from 'vitest';
import { StreamingResponse, StreamState, TokenUsage } from '../StreamingResponse';
import { StreamingError } from '../../exceptions/StreamingError';

describe('StreamingResponse', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create()', () => {
    it('should create streaming response with ID', () => {
      const response = StreamingResponse.create('stream_123');

      expect(response.getId()).toBe('stream_123');
      expect(response.getState()).toBe(StreamState.IDLE);
      expect(response.getStartedAt()).toBeInstanceOf(Date);
    });

    it('should throw for empty ID', () => {
      expect(() => StreamingResponse.create('')).toThrow(StreamingError);
      expect(() => StreamingResponse.create('')).toThrow('non-empty string');
    });

    it('should throw for null ID', () => {
      expect(() => StreamingResponse.create(null as any)).toThrow(StreamingError);
    });

    it('should throw for undefined ID', () => {
      expect(() => StreamingResponse.create(undefined as any)).toThrow(StreamingError);
    });
  });

  describe('State machine: IDLE → STREAMING', () => {
    it('should transition from IDLE to STREAMING', () => {
      const response = StreamingResponse.create('stream_1');

      response.start();

      expect(response.isStreaming()).toBe(true);
      expect(response.getState()).toBe(StreamState.STREAMING);
    });

    it('should throw when starting already STREAMING', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      expect(() => response.start()).toThrow(StreamingError);
      expect(() => response.start()).toThrow('streaming state');
    });

    it('should throw when starting COMPLETED response', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(() => response.start()).toThrow(StreamingError);
    });

    it('should throw when starting FAILED response', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.fail(new Error('test'));

      expect(() => response.start()).toThrow(StreamingError);
    });
  });

  describe('Adding chunks', () => {
    it('should add text chunk while streaming', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.addTextChunk('Hello ');
      response.addTextChunk('World');

      expect(response.getChunks()).toHaveLength(2);
      expect(response.getTextContent()).toBe('Hello World');
    });

    it('should add tool call chunk while streaming', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.addToolCallChunk('call_1', 'get_weather', { location: 'London' });

      const toolCalls = response.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        toolCallId: 'call_1',
        toolName: 'get_weather',
        args: { location: 'London' },
      });
    });

    it('should add tool result chunk while streaming', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.addToolResultChunk('call_1', 'get_weather', { temp: 15 });

      expect(response.getChunks()).toHaveLength(1);
    });

    it('should throw when adding text chunk to IDLE response', () => {
      const response = StreamingResponse.create('stream_1');

      expect(() => response.addTextChunk('test')).toThrow(StreamingError);
      expect(() => response.addTextChunk('test')).toThrow('idle state');
    });

    it('should throw when adding chunk to COMPLETED response', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(() => response.addTextChunk('test')).toThrow(StreamingError);
    });

    it('should throw when adding chunk to FAILED response', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.fail(new Error('test'));

      expect(() => response.addTextChunk('test')).toThrow(StreamingError);
    });

    it('should throw when adding chunk to CANCELLED response', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.cancel();

      expect(() => response.addTextChunk('test')).toThrow(StreamingError);
    });
  });

  describe('State machine: STREAMING → COMPLETED', () => {
    it('should complete with token usage and finish reason', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.addTextChunk('Response text');

      const usage: TokenUsage = {
        promptTokens: 50,
        completionTokens: 30,
        totalTokens: 80,
      };

      response.complete(usage, 'stop');

      expect(response.isCompleted()).toBe(true);
      expect(response.getTokenUsage()).toEqual(usage);
      expect(response.getFinishReason()).toBe('stop');
      expect(response.getCompletedAt()).toBeInstanceOf(Date);
    });

    it('should throw when completing from IDLE', () => {
      const response = StreamingResponse.create('stream_1');

      expect(() =>
        response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop')
      ).toThrow(StreamingError);
    });

    it('should throw when completing already COMPLETED', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(() =>
        response.complete({ promptTokens: 5, completionTokens: 5, totalTokens: 10 }, 'stop')
      ).toThrow(StreamingError);
    });

    it('should add finish chunk when completing', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      const usage: TokenUsage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
      response.complete(usage, 'stop');

      const chunks = response.getChunks();
      const finishChunk = chunks[chunks.length - 1];
      expect(finishChunk.type).toBe('finish');
      expect(finishChunk.usage).toEqual(usage);
    });
  });

  describe('State machine: STREAMING → FAILED', () => {
    it('should fail with error', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      const error = new Error('Stream timeout');
      response.fail(error);

      expect(response.isFailed()).toBe(true);
      expect(response.getError()).toBe(error);
      expect(response.getCompletedAt()).toBeInstanceOf(Date);
    });

    it('should throw when failing from IDLE', () => {
      const response = StreamingResponse.create('stream_1');

      expect(() => response.fail(new Error('test'))).toThrow(StreamingError);
    });

    it('should throw when failing already COMPLETED', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(() => response.fail(new Error('test'))).toThrow(StreamingError);
    });

    it('should add error chunk when failing', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.fail(new Error('Connection lost'));

      const chunks = response.getChunks();
      const errorChunk = chunks[chunks.length - 1];
      expect(errorChunk.type).toBe('error');
      expect(errorChunk.error).toBe('Connection lost');
    });
  });

  describe('State machine: STREAMING → CANCELLED', () => {
    it('should cancel streaming', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.cancel();

      expect(response.isCancelled()).toBe(true);
      expect(response.getCompletedAt()).toBeInstanceOf(Date);
    });

    it('should throw when cancelling from IDLE', () => {
      const response = StreamingResponse.create('stream_1');

      expect(() => response.cancel()).toThrow(StreamingError);
    });

    it('should throw when cancelling already COMPLETED', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(() => response.cancel()).toThrow(StreamingError);
    });
  });

  describe('Query methods', () => {
    it('should identify IDLE state', () => {
      const response = StreamingResponse.create('stream_1');

      expect(response.isStreaming()).toBe(false);
      expect(response.isCompleted()).toBe(false);
      expect(response.isFailed()).toBe(false);
      expect(response.isCancelled()).toBe(false);
      expect(response.isFinished()).toBe(false);
    });

    it('should identify STREAMING state', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      expect(response.isStreaming()).toBe(true);
      expect(response.isCompleted()).toBe(false);
      expect(response.isFailed()).toBe(false);
      expect(response.isCancelled()).toBe(false);
      expect(response.isFinished()).toBe(false);
    });

    it('should identify COMPLETED state', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(response.isStreaming()).toBe(false);
      expect(response.isCompleted()).toBe(true);
      expect(response.isFailed()).toBe(false);
      expect(response.isCancelled()).toBe(false);
      expect(response.isFinished()).toBe(true);
    });

    it('should identify FAILED state', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.fail(new Error('test'));

      expect(response.isStreaming()).toBe(false);
      expect(response.isCompleted()).toBe(false);
      expect(response.isFailed()).toBe(true);
      expect(response.isCancelled()).toBe(false);
      expect(response.isFinished()).toBe(true);
    });

    it('should identify CANCELLED state', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.cancel();

      expect(response.isStreaming()).toBe(false);
      expect(response.isCompleted()).toBe(false);
      expect(response.isFailed()).toBe(false);
      expect(response.isCancelled()).toBe(true);
      expect(response.isFinished()).toBe(true);
    });

    it('should detect tool calls', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.addToolCallChunk('call_1', 'get_weather', {});

      expect(response.hasToolCalls()).toBe(true);
    });

    it('should return false when no tool calls', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.addTextChunk('Text only');

      expect(response.hasToolCalls()).toBe(false);
    });
  });

  describe('getTextContent()', () => {
    it('should concatenate all text chunks', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.addTextChunk('Hello ');
      response.addTextChunk('world');
      response.addTextChunk('!');

      expect(response.getTextContent()).toBe('Hello world!');
    });

    it('should return empty string when no text chunks', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      expect(response.getTextContent()).toBe('');
    });

    it('should ignore non-text chunks', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.addTextChunk('Text ');
      response.addToolCallChunk('call_1', 'tool', {});
      response.addTextChunk('only');

      expect(response.getTextContent()).toBe('Text only');
    });
  });

  describe('getToolCalls()', () => {
    it('should return all tool call chunks', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      response.addToolCallChunk('call_1', 'weather', { city: 'London' });
      response.addToolCallChunk('call_2', 'time', { timezone: 'UTC' });

      const toolCalls = response.getToolCalls();
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0]).toEqual({
        toolCallId: 'call_1',
        toolName: 'weather',
        args: { city: 'London' },
      });
      expect(toolCalls[1]).toEqual({
        toolCallId: 'call_2',
        toolName: 'time',
        args: { timezone: 'UTC' },
      });
    });

    it('should return empty array when no tool calls', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      expect(response.getToolCalls()).toEqual([]);
    });
  });

  describe('getStreamingDuration()', () => {
    it('should return undefined for IDLE response', () => {
      const response = StreamingResponse.create('stream_1');

      expect(response.getStreamingDuration()).toBeUndefined();
    });

    it('should return undefined for STREAMING response', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();

      expect(response.getStreamingDuration()).toBeUndefined();
    });

    it('should return duration for COMPLETED response', () => {
      vi.useFakeTimers();
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(startTime);

      const response = StreamingResponse.create('stream_1');
      response.start();

      vi.setSystemTime(new Date('2024-01-01T10:00:03Z')); // 3 seconds later
      response.complete({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }, 'stop');

      expect(response.getStreamingDuration()).toBe(3000); // 3000ms
    });

    it('should return duration for FAILED response', () => {
      vi.useFakeTimers();
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(startTime);

      const response = StreamingResponse.create('stream_1');
      response.start();

      vi.setSystemTime(new Date('2024-01-01T10:00:02Z')); // 2 seconds later
      response.fail(new Error('timeout'));

      expect(response.getStreamingDuration()).toBe(2000); // 2000ms
    });
  });

  describe('Defensive copying', () => {
    it('should return defensive copy of chunks', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.addTextChunk('test');

      const chunks1 = response.getChunks();
      const chunks2 = response.getChunks();

      expect(chunks1).toEqual(chunks2);
      expect(chunks1).not.toBe(chunks2);
    });
  });

  describe('toObject()', () => {
    it('should convert streaming response to object', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.addTextChunk('Hello');
      response.complete({ promptTokens: 10, completionTokens: 5, totalTokens: 15 }, 'stop');

      const obj = response.toObject();

      expect(obj.id).toBe('stream_1');
      expect(obj.state).toBe(StreamState.COMPLETED);
      expect(obj.chunkCount).toBe(2); // text chunk + finish chunk
      expect(obj.textContent).toBe('Hello');
      expect(obj.tokenUsage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
      expect(obj.finishReason).toBe('stop');
      expect(obj.duration).toBeDefined();
    });

    it('should include error in object when failed', () => {
      const response = StreamingResponse.create('stream_1');
      response.start();
      response.fail(new Error('Network error'));

      const obj = response.toObject();

      expect(obj.state).toBe(StreamState.FAILED);
      expect(obj.error).toBe('Network error');
    });
  });
});
