// ABOUTME: Port for AI completion providers abstracting LLM implementations
// ABOUTME: Allows swapping OpenAI for other providers without changing business logic

import { Message } from '../../../domain/entities/Message';
import { TokenUsage } from '../../../domain/entities/StreamingResponse';

export interface AICompletionRequest {
  messages: Message[];
  tools: ToolDefinition[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIStreamChunk {
  type: 'text' | 'tool_call' | 'usage' | 'error';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
  usage?: TokenUsage;
  error?: string;
  finishReason?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface IAIProvider {
  /**
   * Streams chat completion from AI provider
   */
  streamCompletion(
    request: AICompletionRequest
  ): AsyncIterable<AIStreamChunk>;

  /**
   * Gets available models
   */
  getAvailableModels(): Promise<string[]>;

  /**
   * Validates API key and connectivity
   */
  validateConnection(): Promise<boolean>;

  /**
   * Gets provider name
   */
  getProviderName(): string;
}