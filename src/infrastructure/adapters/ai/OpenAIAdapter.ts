// ABOUTME: Implements IAIProvider for OpenAI's GPT models
// ABOUTME: Converts domain messages to OpenAI format and streams responses

import OpenAI from 'openai';
import { IAIProvider, AICompletionRequest, AIStreamChunk, ToolDefinition } from '../../../application/ports/outbound/IAIProvider';
import { OpenAIMessageConverter } from './OpenAIMessageConverter';

export class OpenAIAdapter implements IAIProvider {
  private readonly client: OpenAI;
  private readonly messageConverter: OpenAIMessageConverter;
  private readonly defaultModel: string = 'gpt-4o';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({ apiKey });
    this.messageConverter = new OpenAIMessageConverter();
  }

  async *streamCompletion(request: AICompletionRequest): AsyncIterable<AIStreamChunk> {
    try {
      // Convert messages to OpenAI format
      const openaiMessages = this.messageConverter.toOpenAIFormat(request.messages);
      const tools = request.tools.length > 0
        ? this.messageConverter.toOpenAITools(request.tools)
        : undefined;

      // Create streaming request
      const stream = await this.client.chat.completions.create({
        messages: openaiMessages,
        model: request.model || this.defaultModel,
        stream: true,
        tools: tools,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      });

      // Track tool calls being accumulated
      const draftToolCalls: Map<number, any> = new Map();
      const yieldedToolCalls = new Set<string>(); // Track which tool calls have been yielded

      // Process stream chunks
      for await (const chunk of stream) {
        for (const choice of chunk.choices) {
          // Handle completion
          if (choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls') {
            // If we have accumulated tool calls, yield them
            for (const [_, toolCall] of draftToolCalls) {
              // Parse arguments if not already parsed
              let args = toolCall.parsedArguments;
              if (!args && toolCall.arguments) {
                try {
                  args = JSON.parse(toolCall.arguments);
                } catch (error) {
                  console.error('Failed to parse tool arguments:', error);
                  args = {};
                }
              }

              // Only yield if we haven't already yielded this tool call
              if (!yieldedToolCalls.has(toolCall.id)) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id,
                    name: toolCall.name,
                    arguments: args || {},
                  },
                };
                yieldedToolCalls.add(toolCall.id);
              }
            }

            // Always yield usage when we have a finish reason
            // OpenAI may not send usage separately for tool calls
            yield {
              type: 'usage',
              usage: chunk.usage ? {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              } : {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
              },
              finishReason: choice.finish_reason,
            };
          }
          // Handle tool calls
          else if (choice.delta.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
              const index = toolCall.index;

              if (!draftToolCalls.has(index)) {
                draftToolCalls.set(index, {
                  id: '',
                  name: '',
                  arguments: '',
                });
              }

              const draft = draftToolCalls.get(index)!;

              if (toolCall.id) {
                draft.id = toolCall.id;
              }
              if (toolCall.function?.name) {
                draft.name = toolCall.function.name;
              }
              if (toolCall.function?.arguments) {
                draft.arguments += toolCall.function.arguments;
              }

              // Try to parse accumulated arguments
              if (draft.arguments) {
                try {
                  const parsedArgs = JSON.parse(draft.arguments);
                  draft.parsedArguments = parsedArgs;
                } catch {
                  // Arguments not yet complete
                }
              }
            }
          }
          // Handle text content
          else if (choice.delta.content) {
            yield {
              type: 'text',
              content: choice.delta.content,
            };
          }
        }

        // Handle standalone usage (some models send this separately)
        if (chunk.choices.length === 0 && chunk.usage) {
          yield {
            type: 'usage',
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
            finishReason: 'stop',
          };
        }
      }

      // Final check for completed tool calls (in case they weren't yielded yet)
      for (const [_, toolCall] of draftToolCalls) {
        // Parse arguments if not already parsed
        let args = toolCall.parsedArguments;
        if (!args && toolCall.arguments) {
          try {
            args = JSON.parse(toolCall.arguments);
          } catch (error) {
            console.error('Failed to parse tool arguments:', error);
            continue; // Skip this tool call if we can't parse it
          }
        }

        // Only yield if we haven't already yielded this tool call
        if (args && !yieldedToolCalls.has(toolCall.id)) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: toolCall.id,
              name: toolCall.name,
              arguments: args,
            },
          };
          yieldedToolCalls.add(toolCall.id);
        }
      }

    } catch (error) {
      // Yield error chunk
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      throw error;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [this.defaultModel];
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Try to list models as a connectivity check
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI connection validation failed:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'OpenAI';
  }
}