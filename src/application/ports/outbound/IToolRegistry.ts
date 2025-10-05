// ABOUTME: Port for tool registration and execution
// ABOUTME: Decouples tool implementations from the core application logic

import { ToolName } from '../../../domain/value-objects/ToolName';
import { ToolDefinition } from './IAIProvider';

export interface ITool {
  /**
   * Gets the tool name
   */
  getName(): ToolName;

  /**
   * Gets the tool description
   */
  getDescription(): string;

  /**
   * Gets the tool parameters schema
   */
  getParameters(): {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  /**
   * Executes the tool with given arguments
   */
  execute(args: Record<string, unknown>): Promise<unknown>;

  /**
   * Validates arguments before execution
   */
  validateArgs(args: Record<string, unknown>): boolean;
}

export interface IToolRegistry {
  /**
   * Registers a tool
   */
  register(tool: ITool): void;

  /**
   * Unregisters a tool
   */
  unregister(toolName: ToolName): void;

  /**
   * Executes a tool by name
   */
  execute(toolName: ToolName, args: Record<string, unknown>): Promise<unknown>;

  /**
   * Gets all registered tools
   */
  getAllDefinitions(): ToolDefinition[];

  /**
   * Gets a specific tool
   */
  getTool(toolName: ToolName): ITool | undefined;

  /**
   * Checks if tool exists
   */
  has(toolName: ToolName): boolean;

  /**
   * Gets tool count
   */
  count(): number;
}