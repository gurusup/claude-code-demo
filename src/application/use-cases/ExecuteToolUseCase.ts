// ABOUTME: Handles individual tool execution outside of streaming context
// ABOUTME: Useful for testing tools or manual tool execution

import { ToolInvocation } from '../../domain/entities/ToolInvocation';
import { ToolName } from '../../domain/value-objects/ToolName';
import { IToolRegistry } from '../ports/outbound/IToolRegistry';
import { randomUUID } from 'crypto';

export interface ToolExecutionRequest {
  toolName: string;
  args: Record<string, unknown>;
  callId?: string;
}

export interface ToolExecutionResult {
  toolInvocation: ToolInvocation;
  result: unknown;
  executionTime: number;
}

export class ExecuteToolUseCase {
  constructor(private readonly toolRegistry: IToolRegistry) {}

  /**
   * Executes a single tool and returns the result
   */
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Create tool invocation
    const toolName = ToolName.from(request.toolName);
    const callId = request.callId || randomUUID();
    const toolInvocation = ToolInvocation.create(callId, toolName, request.args);

    // Check if tool exists
    if (!this.toolRegistry.has(toolName)) {
      const error = new Error(`Tool not found: ${request.toolName}`);
      toolInvocation.markAsExecuting();
      toolInvocation.fail(error);
      throw error;
    }

    try {
      // Mark as executing
      toolInvocation.markAsExecuting();

      // Execute tool
      const result = await this.toolRegistry.execute(toolName, request.args);

      // Mark as completed
      toolInvocation.complete(result);

      const executionTime = Date.now() - startTime;

      return {
        toolInvocation,
        result,
        executionTime,
      };
    } catch (error) {
      // Mark as failed
      toolInvocation.fail(error as Error);
      throw error;
    }
  }

  /**
   * Executes multiple tools in parallel
   */
  async executeMultiple(
    requests: ToolExecutionRequest[]
  ): Promise<ToolExecutionResult[]> {
    const promises = requests.map(request => this.execute(request));
    return Promise.all(promises);
  }

  /**
   * Executes multiple tools sequentially
   */
  async executeSequential(
    requests: ToolExecutionRequest[]
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);
    }

    return results;
  }

  /**
   * Validates tool arguments without executing
   */
  validateToolArgs(toolName: string, args: Record<string, unknown>): boolean {
    const tool = this.toolRegistry.getTool(ToolName.from(toolName));

    if (!tool) {
      return false;
    }

    return tool.validateArgs(args);
  }

  /**
   * Gets available tools
   */
  getAvailableTools(): Array<{ name: string; description: string }> {
    return this.toolRegistry.getAllDefinitions().map(def => ({
      name: def.function.name,
      description: def.function.description,
    }));
  }
}