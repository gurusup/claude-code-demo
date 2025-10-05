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
      streamingResponse.start();

      // Prepare AI request
      const messages = conversation.getMessages();
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
              // Execute tools before finishing
              if (pendingToolCalls.length > 0) {
                await this.executeToolsAndStream(
                  pendingToolCalls,
                  streamingResponse,
                  controller
                );
              }

              // Complete streaming
              streamingResponse.complete(chunk.usage, chunk.finishReason || 'stop');
              this.streamFinish(chunk.usage, controller);

              // Create assistant message
              const assistantMessage = Message.create(
                MessageRole.assistant(),
                MessageContent.from(accumulatedText || ''),
                [],
                pendingToolCalls
              );

              // Add message to conversation
              this.orchestrator.processAssistantMessage(
                conversation,
                assistantMessage,
                streamingResponse
              );

              // Save conversation
              await this.conversationRepository.save(conversation);
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
    streamingResponse: StreamingResponse,
    controller: ReadableStreamDefaultController
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      try {
        toolCall.markAsExecuting();

        const result = await this.toolRegistry.execute(
          toolCall.getToolName(),
          toolCall.getArgs()
        );

        toolCall.complete(result);
        streamingResponse.addToolResultChunk(
          toolCall.getCallId(),
          toolCall.getToolName().getValue(),
          result
        );

        this.streamToolResult(toolCall, controller);
      } catch (error) {
        toolCall.fail(error as Error);
        console.error(`Tool execution failed:`, error);

        // Stream error information to client
        const errorData: StreamData = {
          type: 'tool_result',
          payload: {
            toolCallId: toolCall.getCallId(),
            toolName: toolCall.getToolName().getValue(),
            args: toolCall.getArgs(),
            result: {
              error: true,
              message: `Tool execution failed: ${(error as Error).message}`,
            },
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