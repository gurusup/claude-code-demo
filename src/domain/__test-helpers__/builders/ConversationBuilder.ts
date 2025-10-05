// ABOUTME: Test builder for creating Conversation instances with fluent API
// ABOUTME: Provides convenient methods for setting up conversations in various states

import { Conversation, ConversationStatus } from '../../entities/Conversation';
import { Message } from '../../entities/Message';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';

export class ConversationBuilder {
  private id: string = 'conv_test123';
  private messages: Message[] = [];
  private status: ConversationStatus = ConversationStatus.ACTIVE;
  private createdAt: Date = new Date();
  private updatedAt: Date = new Date();
  private title?: string;

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withMessages(messages: Message[]): this {
    this.messages = messages;
    return this;
  }

  withMessage(message: Message): this {
    this.messages.push(message);
    return this;
  }

  withUserMessage(content: string): this {
    const message = Message.create(MessageRole.user(), MessageContent.from(content));
    this.messages.push(message);
    return this;
  }

  withAssistantMessage(content: string): this {
    const message = Message.create(MessageRole.assistant(), MessageContent.from(content));
    this.messages.push(message);
    return this;
  }

  withSystemMessage(content: string): this {
    const message = Message.create(MessageRole.system(), MessageContent.from(content));
    this.messages.push(message);
    return this;
  }

  withMessageCount(count: number): this {
    this.messages = [];
    for (let i = 0; i < count; i++) {
      const role = i % 2 === 0 ? MessageRole.user() : MessageRole.assistant();
      const content = MessageContent.from(`Message ${i + 1}`);
      this.messages.push(Message.create(role, content));
    }
    return this;
  }

  withStatus(status: ConversationStatus): this {
    this.status = status;
    return this;
  }

  active(): this {
    this.status = ConversationStatus.ACTIVE;
    return this;
  }

  waitingForResponse(): this {
    this.status = ConversationStatus.WAITING_FOR_RESPONSE;
    return this;
  }

  completed(): this {
    this.status = ConversationStatus.COMPLETED;
    return this;
  }

  archived(): this {
    this.status = ConversationStatus.ARCHIVED;
    return this;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.createdAt = date;
    return this;
  }

  withUpdatedAt(date: Date): this {
    this.updatedAt = date;
    return this;
  }

  build(): Conversation {
    if (this.messages.length === 0 && !this.title) {
      // Simple conversation without restoration
      return Conversation.create(this.id);
    }

    // Use restore for conversations with specific state
    return Conversation.restore(
      this.id,
      this.messages,
      this.status,
      this.createdAt,
      this.updatedAt,
      this.title
    );
  }
}
