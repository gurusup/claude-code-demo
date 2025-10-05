// ABOUTME: Domain exception for tool execution failures
// ABOUTME: Thrown when tool invocation or execution violates state machine rules

export class ToolExecutionError extends Error {
  constructor(message: string, public readonly toolName?: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ToolExecutionError';
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }

  static fromCause(toolName: string, cause: Error): ToolExecutionError {
    return new ToolExecutionError(
      `Tool '${toolName}' execution failed: ${cause.message}`,
      toolName,
      cause
    );
  }
}