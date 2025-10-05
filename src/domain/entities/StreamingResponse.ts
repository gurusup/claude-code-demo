// ABOUTME: Domain entity representing a streaming response with chunks
// ABOUTME: Manages the lifecycle of a streaming AI response including tool calls

import { StreamingError } from '../exceptions/StreamingError';

export enum StreamState {
  IDLE = 'idle',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'finish' | 'error';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  usage?: TokenUsage;
  error?: string;
  timestamp: Date;
}

export class StreamingResponse {
  private readonly id: string;
  private state: StreamState;
  private chunks: StreamChunk[];
  private tokenUsage?: TokenUsage;
  private readonly startedAt: Date;
  private completedAt?: Date;
  private error?: Error;
  private finishReason?: string;

  private constructor(id: string) {
    this.id = id;
    this.state = StreamState.IDLE;
    this.chunks = [];
    this.startedAt = new Date();
  }

  static create(id: string): StreamingResponse {
    if (!id || typeof id !== 'string') {
      throw new StreamingError('Streaming response ID must be a non-empty string');
    }
    return new StreamingResponse(id);
  }

  start(): void {
    if (this.state !== StreamState.IDLE) {
      throw new StreamingError(
        `Cannot start streaming: response is in ${this.state} state`
      );
    }
    this.state = StreamState.STREAMING;
  }

  addTextChunk(content: string): void {
    this.validateCanAddChunk();
    this.chunks.push({
      type: 'text',
      content,
      timestamp: new Date(),
    });
  }

  addToolCallChunk(toolCallId: string, toolName: string, args: Record<string, unknown>): void {
    this.validateCanAddChunk();
    this.chunks.push({
      type: 'tool_call',
      toolCallId,
      toolName,
      toolArgs: args,
      timestamp: new Date(),
    });
  }

  addToolResultChunk(toolCallId: string, toolName: string, result: unknown): void {
    this.validateCanAddChunk();
    this.chunks.push({
      type: 'tool_result',
      toolCallId,
      toolName,
      toolResult: result,
      timestamp: new Date(),
    });
  }

  complete(usage: TokenUsage, finishReason: string): void {
    if (this.state !== StreamState.STREAMING) {
      throw new StreamingError(
        `Cannot complete: streaming response must be in streaming state, but is in ${this.state} state`
      );
    }

    this.chunks.push({
      type: 'finish',
      usage,
      timestamp: new Date(),
    });

    this.tokenUsage = usage;
    this.finishReason = finishReason;
    this.state = StreamState.COMPLETED;
    this.completedAt = new Date();
  }

  fail(error: Error): void {
    if (this.state !== StreamState.STREAMING) {
      throw new StreamingError(
        `Cannot fail: streaming response must be in streaming state, but is in ${this.state} state`
      );
    }

    this.chunks.push({
      type: 'error',
      error: error.message,
      timestamp: new Date(),
    });

    this.error = error;
    this.state = StreamState.FAILED;
    this.completedAt = new Date();
  }

  cancel(): void {
    if (this.state !== StreamState.STREAMING) {
      throw new StreamingError(
        `Cannot cancel: streaming response must be in streaming state, but is in ${this.state} state`
      );
    }

    this.state = StreamState.CANCELLED;
    this.completedAt = new Date();
  }

  private validateCanAddChunk(): void {
    if (this.state !== StreamState.STREAMING) {
      throw new StreamingError(
        `Cannot add chunk: streaming response is in ${this.state} state`,
        this.state
      );
    }
  }

  // Query methods
  isStreaming(): boolean {
    return this.state === StreamState.STREAMING;
  }

  isCompleted(): boolean {
    return this.state === StreamState.COMPLETED;
  }

  isFailed(): boolean {
    return this.state === StreamState.FAILED;
  }

  isCancelled(): boolean {
    return this.state === StreamState.CANCELLED;
  }

  isFinished(): boolean {
    return this.isCompleted() || this.isFailed() || this.isCancelled();
  }

  hasToolCalls(): boolean {
    return this.chunks.some(c => c.type === 'tool_call');
  }

  getTextContent(): string {
    return this.chunks
      .filter(c => c.type === 'text')
      .map(c => c.content || '')
      .join('');
  }

  getToolCalls(): Array<{ toolCallId: string; toolName: string; args: Record<string, unknown> }> {
    return this.chunks
      .filter(c => c.type === 'tool_call')
      .map(c => ({
        toolCallId: c.toolCallId!,
        toolName: c.toolName!,
        args: c.toolArgs!,
      }));
  }

  getStreamingDuration(): number | undefined {
    if (!this.completedAt) return undefined;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getState(): StreamState {
    return this.state;
  }

  getChunks(): readonly StreamChunk[] {
    return [...this.chunks];
  }

  getTokenUsage(): TokenUsage | undefined {
    return this.tokenUsage;
  }

  getError(): Error | undefined {
    return this.error;
  }

  getFinishReason(): string | undefined {
    return this.finishReason;
  }

  getStartedAt(): Date {
    return this.startedAt;
  }

  getCompletedAt(): Date | undefined {
    return this.completedAt;
  }

  toObject(): {
    id: string;
    state: StreamState;
    chunkCount: number;
    textContent: string;
    tokenUsage?: TokenUsage;
    finishReason?: string;
    duration?: number;
    error?: string;
  } {
    return {
      id: this.id,
      state: this.state,
      chunkCount: this.chunks.length,
      textContent: this.getTextContent(),
      tokenUsage: this.tokenUsage,
      finishReason: this.finishReason,
      duration: this.getStreamingDuration(),
      error: this.error?.message,
    };
  }
}