// ABOUTME: Factory for creating valid test messages with sensible defaults
// ABOUTME: Provides convenience methods for common message scenarios

import { Message } from '../../entities/Message';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';
import { Attachment } from '../../value-objects/Attachment';
import { ToolInvocation } from '../../entities/ToolInvocation';
import { ToolName } from '../../value-objects/ToolName';

export class MessageFactory {
  /**
   * Create a valid user message with minimal test data
   */
  static createValidUserMessage(content: string = 'test user message'): Message {
    return Message.create(
      MessageRole.user(),
      MessageContent.from(content),
      [],
      []
    );
  }

  /**
   * Create a valid assistant message with minimal test data
   */
  static createValidAssistantMessage(content: string = 'test assistant response'): Message {
    return Message.create(
      MessageRole.assistant(),
      MessageContent.from(content),
      [],
      []
    );
  }

  /**
   * Create a valid system message
   */
  static createValidSystemMessage(content: string = 'test system message'): Message {
    return Message.create(
      MessageRole.system(),
      MessageContent.from(content),
      [],
      []
    );
  }

  /**
   * Create a valid tool message (response to a tool invocation)
   */
  static createValidToolMessage(
    toolCallId: string = 'tool-call-1',
    result: string = 'tool result'
  ): Message {
    return Message.createToolMessage(toolCallId, result);
  }

  /**
   * Create a user message with attachments
   */
  static createMessageWithAttachments(
    content: string = 'message with attachments',
    attachmentCount: number = 1
  ): Message {
    const attachments: Attachment[] = [];
    for (let i = 0; i < attachmentCount; i++) {
      attachments.push(
        Attachment.create(
          `file-${i}.png`,
          'image/png',
          `https://example.com/file-${i}.png`
        )
      );
    }

    return Message.create(
      MessageRole.user(),
      MessageContent.from(content),
      attachments,
      []
    );
  }

  /**
   * Create a user message with image attachments
   */
  static createMessageWithImageAttachment(): Message {
    return this.createMessageWithAttachments('check this image', 1);
  }

  /**
   * Create an assistant message with tool invocations
   */
  static createMessageWithToolInvocations(
    toolCount: number = 1,
    content: string = ''
  ): Message {
    const toolInvocations: ToolInvocation[] = [];
    for (let i = 0; i < toolCount; i++) {
      toolInvocations.push(
        ToolInvocation.create(
          `call-${i}`,
          ToolName.from('test_tool'),
          { arg: `value-${i}` }
        )
      );
    }

    return Message.create(
      MessageRole.assistant(),
      MessageContent.from(content),
      [],
      toolInvocations
    );
  }

  /**
   * Create a message with specific ID (useful for testing)
   */
  static createWithId(
    id: string,
    role: MessageRole = MessageRole.user(),
    content: string = 'test message'
  ): Message {
    return Message.createWithId(
      id,
      role,
      MessageContent.from(content),
      [],
      []
    );
  }

  /**
   * Create an empty content message (for testing validation)
   */
  static createWithEmptyContent(role: MessageRole = MessageRole.user()): Message {
    return Message.create(
      role,
      MessageContent.empty(),
      [],
      []
    );
  }

  /**
   * Create a sequence of alternating user/assistant messages
   */
  static createMessageSequence(count: number): Message[] {
    const messages: Message[] = [];
    for (let i = 0; i < count; i++) {
      const isUser = i % 2 === 0;
      messages.push(
        isUser
          ? this.createValidUserMessage(`user message ${i}`)
          : this.createValidAssistantMessage(`assistant message ${i}`)
      );
    }
    return messages;
  }
}
