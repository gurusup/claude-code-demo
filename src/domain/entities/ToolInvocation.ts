// ABOUTME: Domain entity representing a tool invocation with state machine
// ABOUTME: Tracks progression from call to result with business rule validation

import { ToolName } from '../value-objects/ToolName';
import { ToolExecutionError } from '../exceptions/ToolExecutionError';

export enum ToolInvocationState {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class ToolInvocation {
  private state: ToolInvocationState;
  private readonly callId: string;
  private readonly toolName: ToolName;
  private readonly args: Record<string, unknown>;
  private result?: unknown;
  private error?: Error;
  private readonly createdAt: Date;
  private completedAt?: Date;

  private constructor(callId: string, toolName: ToolName, args: Record<string, unknown>) {
    this.callId = callId;
    this.toolName = toolName;
    this.args = Object.freeze({ ...args }); // Immutable args
    this.state = ToolInvocationState.PENDING;
    this.createdAt = new Date();
  }

  static create(callId: string, toolName: ToolName, args: Record<string, unknown>): ToolInvocation {
    if (!callId || typeof callId !== 'string') {
      throw new ToolExecutionError('Tool invocation call ID must be a non-empty string');
    }
    return new ToolInvocation(callId, toolName, args);
  }

  markAsExecuting(): void {
    if (this.state !== ToolInvocationState.PENDING) {
      throw new ToolExecutionError(
        `Cannot start execution: tool invocation is in ${this.state} state`
      );
    }
    this.state = ToolInvocationState.EXECUTING;
  }

  complete(result: unknown): void {
    if (this.state !== ToolInvocationState.EXECUTING) {
      throw new ToolExecutionError(
        `Cannot complete: tool invocation must be in executing state, but is in ${this.state} state`
      );
    }
    this.result = result;
    this.state = ToolInvocationState.COMPLETED;
    this.completedAt = new Date();
  }

  fail(error: Error): void {
    if (this.state !== ToolInvocationState.EXECUTING) {
      throw new ToolExecutionError(
        `Cannot fail: tool invocation must be in executing state, but is in ${this.state} state`
      );
    }
    this.error = error;
    this.state = ToolInvocationState.FAILED;
    this.completedAt = new Date();
  }

  // Query methods
  isPending(): boolean {
    return this.state === ToolInvocationState.PENDING;
  }

  isExecuting(): boolean {
    return this.state === ToolInvocationState.EXECUTING;
  }

  isCompleted(): boolean {
    return this.state === ToolInvocationState.COMPLETED;
  }

  isFailed(): boolean {
    return this.state === ToolInvocationState.FAILED;
  }

  isFinished(): boolean {
    return this.isCompleted() || this.isFailed();
  }

  // Getters
  getCallId(): string {
    return this.callId;
  }

  getToolName(): ToolName {
    return this.toolName;
  }

  getArgs(): Record<string, unknown> {
    return { ...this.args }; // Return copy to maintain immutability
  }

  getState(): ToolInvocationState {
    return this.state;
  }

  getResult(): unknown | undefined {
    return this.result;
  }

  getError(): Error | undefined {
    return this.error;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getCompletedAt(): Date | undefined {
    return this.completedAt;
  }

  getExecutionTime(): number | undefined {
    if (!this.completedAt) return undefined;
    return this.completedAt.getTime() - this.createdAt.getTime();
  }

  toObject(): {
    callId: string;
    toolName: string;
    args: Record<string, unknown>;
    state: ToolInvocationState;
    result?: unknown;
    error?: string;
  } {
    return {
      callId: this.callId,
      toolName: this.toolName.getValue(),
      args: this.getArgs(),
      state: this.state,
      result: this.result,
      error: this.error?.message,
    };
  }
}