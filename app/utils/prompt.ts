// ABOUTME: Utility for converting client messages to OpenAI format
// ABOUTME: Handles attachments and tool invocations in the message conversion

import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ClientMessage } from './types';

export function convertToOpenAIMessages(messages: ClientMessage[]): ChatCompletionMessageParam[] {
  const openaiMessages: ChatCompletionMessageParam[] = [];

  for (const message of messages) {
    const parts: any[] = [];
    const toolCalls: any[] = [];

    // Add text content
    parts.push({
      type: 'text',
      text: message.content
    });

    // Handle attachments
    if (message.experimental_attachments) {
      for (const attachment of message.experimental_attachments) {
        if (attachment.contentType.startsWith('image')) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: attachment.url
            }
          });
        } else if (attachment.contentType.startsWith('text')) {
          parts.push({
            type: 'text',
            text: attachment.url
          });
        }
      }
    }

    // Handle tool invocations
    if (message.toolInvocations) {
      for (const toolInvocation of message.toolInvocations) {
        toolCalls.push({
          id: toolInvocation.toolCallId,
          type: 'function',
          function: {
            name: toolInvocation.toolName,
            arguments: JSON.stringify(toolInvocation.args)
          }
        });
      }
    }

    // Create the message object
    const messageObj: any = {
      role: message.role,
      content: parts
    };

    // Add tool calls if present
    if (toolCalls.length > 0) {
      messageObj.tool_calls = toolCalls;
    }

    openaiMessages.push(messageObj);

    // Add tool result messages if there are tool invocations
    if (message.toolInvocations) {
      for (const toolInvocation of message.toolInvocations) {
        if (toolInvocation.result !== undefined) {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolInvocation.toolCallId,
            content: JSON.stringify(toolInvocation.result)
          });
        }
      }
    }
  }

  return openaiMessages;
}