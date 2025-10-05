// ABOUTME: Orchestrates streaming chat completion with tool execution
// ABOUTME: Pure business logic coordinating AI provider, tools, and streaming

import { Conversation } from '../../domain/entities/Conversation';
import { Message } from '../../domain/entities/Message';
import { ToolInvocation } from '../../domain/entities/ToolInvocation';
import { StreamingResponse, TokenUsage } from '../../domain/entities/StreamingResponse';
import { MessageRole } from '../../domain/value-objects/MessageRole';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { ToolName } from '../../domain/value-objects/ToolName';
import { ConversationOrchestrator } from '../../domain/services/ConversationOrchestrator';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { IAIProvider, AICompletionRequest, AIStreamChunk } from '../ports/outbound/IAIProvider';
import { IToolRegistry } from '../ports/outbound/IToolRegistry';
import { IStreamAdapter, StreamData } from '../ports/outbound/IStreamAdapter';
import { randomUUID } from 'crypto';

export class StreamChatCompletionUseCase {
  private readonly orchestrator: ConversationOrchestrator;

  constructor(
    private readonly aiProvider: IAIProvider,
    private readonly toolRegistry: IToolRegistry,
    private readonly streamAdapter: IStreamAdapter,
    private readonly conversationRepository: IConversationRepository
  ) {
    this.orchestrator = new ConversationOrchestrator();
  }

  async execute(
    conversationId: string,
    controller: ReadableStreamDefaultController
  ): Promise<void> {
    let streamingResponse: StreamingResponse | undefined;

    try {
      // Get conversation
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Prepare for streaming
      const context = this.orchestrator.prepareForStreaming(conversation);
      streamingResponse = context.streamingResponse;
      if (!streamingResponse) {
        throw new Error('Failed to prepare streaming response');
      }
      streamingResponse.start();

      // Prepare AI request
      const messages = [...conversation.getMessages()]; // Create mutable copy
      const tools = this.toolRegistry.getAllDefinitions();

      const request: AICompletionRequest = {
        messages,
        tools,
        model: 'gpt-4o',
      };

      // Stream completion
      const pendingToolCalls: ToolInvocation[] = [];
      let accumulatedText = '';

      for await (const chunk of this.aiProvider.streamCompletion(request)) {
        switch (chunk.type) {
          case 'text':
            if (chunk.content) {
              accumulatedText += chunk.content;
              streamingResponse.addTextChunk(chunk.content);
              this.streamText(chunk.content, controller);
            }
            break;

          case 'tool_call':
            if (chunk.toolCall) {
              const toolInvocation = this.createToolInvocation(chunk.toolCall);
              pendingToolCalls.push(toolInvocation);
              streamingResponse.addToolCallChunk(
                chunk.toolCall.id,
                chunk.toolCall.name,
                chunk.toolCall.arguments
              );
              this.streamToolCall(toolInvocation, controller);
            }
            break;

          case 'usage':
            if (chunk.usage) {
              // First, complete the streaming response if no tools
              // This allows the assistant message to be added properly
              if (pendingToolCalls.length === 0) {
                streamingResponse.complete(chunk.usage, chunk.finishReason || 'stop');
              }

              // Create assistant message with tool invocations
              const assistantMessage = Message.create(
                MessageRole.assistant(),
                MessageContent.from(accumulatedText || ''),
                [],
                pendingToolCalls
              );

              // Add assistant message to conversation
              this.orchestrator.processAssistantMessage(
                conversation,
                assistantMessage,
                streamingResponse
              );

              // Save conversation with assistant message
              await this.conversationRepository.save(conversation);

              // Execute tools if present
              if (pendingToolCalls.length > 0) {
                await this.executeToolsAndStream(
                  pendingToolCalls,
                  conversation,
                  streamingResponse,
                  controller
                );

                // Complete streaming response after tools are executed
                streamingResponse.complete(chunk.usage, chunk.finishReason || 'stop');
              }

              // Stream finish event
              this.streamFinish(chunk.usage, controller);
            }
            break;

          case 'error':
            if (chunk.error) {
              throw new Error(chunk.error);
            }
            break;
        }
      }
    } catch (error) {
      if (streamingResponse && streamingResponse.isStreaming()) {
        streamingResponse.fail(error as Error);
      }
      this.streamError(error as Error, controller);
      throw error;
    } finally {
      this.streamAdapter.close(controller);
    }
  }

  private streamText(content: string, controller: ReadableStreamDefaultController): void {
    const data: StreamData = {
      type: 'text',
      payload: content,
    };
    this.streamAdapter.write(controller, data);
  }

  private streamToolCall(
    toolInvocation: ToolInvocation,
    controller: ReadableStreamDefaultController
  ): void {
    const data: StreamData = {
      type: 'tool_call',
      payload: {
        toolCallId: toolInvocation.getCallId(),
        toolName: toolInvocation.getToolName().getValue(),
        args: toolInvocation.getArgs(),
      },
    };
    this.streamAdapter.write(controller, data);
  }

  private streamToolResult(
    toolInvocation: ToolInvocation,
    controller: ReadableStreamDefaultController
  ): void {
    const data: StreamData = {
      type: 'tool_result',
      payload: {
        toolCallId: toolInvocation.getCallId(),
        toolName: toolInvocation.getToolName().getValue(),
        args: toolInvocation.getArgs(),
        result: toolInvocation.getResult(),
      },
    };
    this.streamAdapter.write(controller, data);
  }

  private streamFinish(
    usage: TokenUsage,
    controller: ReadableStreamDefaultController
  ): void {
    const data: StreamData = {
      type: 'finish',
      payload: {
        finishReason: 'stop',
        usage,
        isContinued: false,
      },
    };
    this.streamAdapter.write(controller, data);
  }

  private streamError(
    error: Error,
    controller: ReadableStreamDefaultController
  ): void {
    const data: StreamData = {
      type: 'error',
      payload: {
        error: error.message,
      },
    };
    this.streamAdapter.write(controller, data);
  }

  private async executeToolsAndStream(
    toolCalls: ToolInvocation[],
    conversation: Conversation,
    streamingResponse: StreamingResponse,
    controller: ReadableStreamDefaultController
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      let toolCompleted = false;

      try {
        toolCall.markAsExecuting();

        const result = await this.toolRegistry.execute(
          toolCall.getToolName(),
          toolCall.getArgs()
        );

        toolCall.complete(result);
        toolCompleted = true;

        streamingResponse.addToolResultChunk(
          toolCall.getCallId(),
          toolCall.getToolName().getValue(),
          result
        );

        this.streamToolResult(toolCall, controller);

        // Create tool result message and add to conversation
        const toolMessage = Message.createToolMessage(
          toolCall.getCallId(),
          JSON.stringify(result)
        );
        conversation.addMessage(toolMessage);

        // Save the conversation with the tool result
        await this.conversationRepository.save(conversation);

      } catch (error) {
        // Only call fail if the tool hasn't been marked as completed
        if (!toolCompleted && toolCall.isExecuting()) {
          toolCall.fail(error as Error);
        }
        console.error(`Tool execution failed:`, error);

        // Create error tool message
        const errorResult = {
          error: true,
          message: `Tool execution failed: ${(error as Error).message}`,
        };

        const toolMessage = Message.createToolMessage(
          toolCall.getCallId(),
          JSON.stringify(errorResult)
        );
        conversation.addMessage(toolMessage);

        // Save the conversation with the error result
        await this.conversationRepository.save(conversation);

        // Stream error information to client
        const errorData: StreamData = {
          type: 'tool_result',
          payload: {
            toolCallId: toolCall.getCallId(),
            toolName: toolCall.getToolName().getValue(),
            args: toolCall.getArgs(),
            result: errorResult,
          },
        };
        this.streamAdapter.write(controller, errorData);
      }
    }
  }

  private createToolInvocation(toolCall: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }): ToolInvocation {
    return ToolInvocation.create(
      toolCall.id,
      ToolName.from(toolCall.name),
      toolCall.arguments
    );
  }
}