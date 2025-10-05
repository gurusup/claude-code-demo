// ABOUTME: Test builder for creating ToolInvocation instances with fluent API
// ABOUTME: Provides convenient methods for setting up test data in various states

import { ToolInvocation, ToolInvocationState } from '../../entities/ToolInvocation';
import { ToolName } from '../../value-objects/ToolName';

export class ToolInvocationBuilder {
  private callId: string = 'call_test123';
  private toolName: ToolName = ToolName.from('test_tool');
  private args: Record<string, unknown> = {};
  private targetState: ToolInvocationState = ToolInvocationState.PENDING;
  private result?: unknown;
  private error?: Error;

  withCallId(callId: string): this {
    this.callId = callId;
    return this;
  }

  withToolName(toolName: string | ToolName): this {
    this.toolName = typeof toolName === 'string' ? ToolName.from(toolName) : toolName;
    return this;
  }

  withArgs(args: Record<string, unknown>): this {
    this.args = args;
    return this;
  }

  pending(): this {
    this.targetState = ToolInvocationState.PENDING;
    return this;
  }

  executing(): this {
    this.targetState = ToolInvocationState.EXECUTING;
    return this;
  }

  completed(result?: unknown): this {
    this.targetState = ToolInvocationState.COMPLETED;
    this.result = result;
    return this;
  }

  failed(error?: Error): this {
    this.targetState = ToolInvocationState.FAILED;
    this.error = error || new Error('Tool execution failed');
    return this;
  }

  build(): ToolInvocation {
    const invocation = ToolInvocation.create(this.callId, this.toolName, this.args);

    // Transition to target state
    if (this.targetState === ToolInvocationState.EXECUTING) {
      invocation.markAsExecuting();
    } else if (this.targetState === ToolInvocationState.COMPLETED) {
      invocation.markAsExecuting();
      invocation.complete(this.result);
    } else if (this.targetState === ToolInvocationState.FAILED) {
      invocation.markAsExecuting();
      invocation.fail(this.error!);
    }

    return invocation;
  }
}
