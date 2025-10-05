// ABOUTME: Implements IToolRegistry for managing and executing tools
// ABOUTME: Maintains a registry of available tools with type-safe execution

import { IToolRegistry, ITool } from '../../../application/ports/outbound/IToolRegistry';
import { ToolDefinition } from '../../../application/ports/outbound/IAIProvider';
import { ToolName } from '../../../domain/value-objects/ToolName';
import { ToolExecutionError } from '../../../domain/exceptions/ToolExecutionError';

export class ToolRegistry implements IToolRegistry {
  private readonly tools: Map<string, ITool>;

  constructor() {
    this.tools = new Map();
  }

  register(tool: ITool): void {
    const name = tool.getName().getValue();

    if (this.tools.has(name)) {
      console.warn(`Tool '${name}' is already registered. Overwriting.`);
    }

    this.tools.set(name, tool);
    console.log(`Registered tool: ${name}`);
  }

  unregister(toolName: ToolName): void {
    const name = toolName.getValue();

    if (!this.tools.has(name)) {
      console.warn(`Tool '${name}' is not registered`);
      return;
    }

    this.tools.delete(name);
    console.log(`Unregistered tool: ${name}`);
  }

  async execute(toolName: ToolName, args: Record<string, unknown>): Promise<unknown> {
    const name = toolName.getValue();
    const tool = this.tools.get(name);

    if (!tool) {
      throw new ToolExecutionError(`Tool not found: ${name}`);
    }

    try {
      // Validate arguments
      if (!tool.validateArgs(args)) {
        throw new ToolExecutionError(`Invalid arguments for tool '${name}'`);
      }

      // Execute tool
      const result = await tool.execute(args);

      console.log(`Successfully executed tool: ${name}`);
      return result;
    } catch (error) {
      console.error(`Tool execution failed for '${name}':`, error);

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      throw ToolExecutionError.fromCause(name, error as Error);
    }
  }

  getAllDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const tool of this.tools.values()) {
      definitions.push({
        type: 'function',
        function: {
          name: tool.getName().getValue(),
          description: tool.getDescription(),
          parameters: tool.getParameters(),
        },
      });
    }

    return definitions;
  }

  getTool(toolName: ToolName): ITool | undefined {
    return this.tools.get(toolName.getValue());
  }

  has(toolName: ToolName): boolean {
    return this.tools.has(toolName.getValue());
  }

  count(): number {
    return this.tools.size;
  }

  /**
   * Gets a list of all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clears all registered tools
   */
  clear(): void {
    this.tools.clear();
    console.log('Cleared all registered tools');
  }

  /**
   * Registers multiple tools at once
   */
  registerMultiple(tools: ITool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Gets tool information without executing
   */
  getToolInfo(toolName: ToolName): {
    name: string;
    description: string;
    parameters: Record<string, any>;
  } | undefined {
    const tool = this.getTool(toolName);

    if (!tool) {
      return undefined;
    }

    return {
      name: tool.getName().getValue(),
      description: tool.getDescription(),
      parameters: tool.getParameters(),
    };
  }
}