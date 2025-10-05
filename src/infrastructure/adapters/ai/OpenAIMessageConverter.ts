// ABOUTME: Converts between domain messages and OpenAI API format
// ABOUTME: Handles multimodal content and tool invocation formatting

import { Message } from '../../../domain/entities/Message';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class OpenAIMessageConverter {
  /**
   * Converts domain messages to OpenAI format
   */
  toOpenAIFormat(messages: readonly Message[]): ChatCompletionMessageParam[] {
    const openaiMessages: ChatCompletionMessageParam[] = [];

    for (const message of messages) {
      const role = this.mapRole(message);

      // Handle tool messages specially
      if (role === 'tool') {
        const toolCallId = message.getMetadata('tool_call_id') as string;
        if (toolCallId) {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: message.getContent().getValue(),
          });
        }
        continue;
      }

      const parts = this.buildMessageParts(message);
      const toolCalls = this.buildToolCalls(message);

      // Create the base message
      const openaiMessage: any = {
        role,
        content: parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts,
      };

      // Add tool calls if present
      if (toolCalls.length > 0 && role === 'assistant') {
        openaiMessage.tool_calls = toolCalls;
      }

      openaiMessages.push(openaiMessage);
    }

    return openaiMessages;
  }

  /**
   * Maps domain role to OpenAI role
   */
  private mapRole(message: Message): 'user' | 'assistant' | 'system' | 'tool' {
    const role = message.getRole();
    if (role.isUser()) return 'user';
    if (role.isAssistant()) return 'assistant';
    if (role.isSystem()) return 'system';
    if (role.isTool()) return 'tool';
    return 'user'; // Default fallback
  }

  /**
   * Builds message content parts including attachments
   */
  private buildMessageParts(message: Message): any[] {
    const parts: any[] = [];

    // Add text content
    const content = message.getContent().getValue();
    if (content) {
      parts.push({
        type: 'text',
        text: content,
      });
    }

    // Add attachments
    for (const attachment of message.getAttachments()) {
      if (attachment.isImage()) {
        parts.push({
          type: 'image_url',
          image_url: {
            url: attachment.getUrl(),
          },
        });
      } else if (attachment.isText()) {
        // For text attachments, include as text
        parts.push({
          type: 'text',
          text: `[Attachment: ${attachment.getName()}]\n${attachment.getUrl()}`,
        });
      }
      // Other attachment types can be handled here
    }

    // If no parts, return empty string to avoid API errors
    if (parts.length === 0) {
      return [''];
    }

    return parts;
  }

  /**
   * Builds tool calls from tool invocations
   */
  private buildToolCalls(message: Message): any[] {
    const toolCalls: any[] = [];

    for (const toolInvocation of message.getToolInvocations()) {
      toolCalls.push({
        id: toolInvocation.getCallId(),
        type: 'function',
        function: {
          name: toolInvocation.getToolName().getValue(),
          arguments: JSON.stringify(toolInvocation.getArgs()),
        },
      });
    }

    return toolCalls;
  }

  /**
   * Converts OpenAI tools format from domain tool definitions
   */
  toOpenAITools(tools: any[]): any[] {
    return tools.map(tool => ({
      type: tool.type || 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }
}