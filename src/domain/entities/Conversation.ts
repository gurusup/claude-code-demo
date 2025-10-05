// ABOUTME: Aggregate root representing a conversation with messages and business rules
// ABOUTME: Enforces message ordering, conversation lifecycle, and invariants

import { Message } from './Message';
import { ConversationError } from '../exceptions/ConversationError';
import { InvalidMessageError } from '../exceptions/InvalidMessageError';
import { randomUUID } from 'crypto';

export enum ConversationStatus {
  ACTIVE = 'active',
  WAITING_FOR_RESPONSE = 'waiting_for_response',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export class Conversation {
  private readonly id: string;
  private messages: Message[];
  private status: ConversationStatus;
  private readonly createdAt: Date;
  private updatedAt: Date;
  private title?: string;
  private readonly metadata: Map<string, unknown>;
  private readonly maxMessages: number = 1000; // Domain rule: limit conversation size

  private constructor(id: string, messages: Message[] = []) {
    this.id = id;
    this.messages = [...messages]; // Defensive copy
    this.status = ConversationStatus.ACTIVE;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.metadata = new Map();
  }

  static create(id?: string): Conversation {
    const conversationId = id || randomUUID();
    return new Conversation(conversationId);
  }

  static restore(
    id: string,
    messages: Message[],
    status: ConversationStatus,
    createdAt: Date,
    updatedAt: Date,
    title?: string
  ): Conversation {
    const conversation = new Conversation(id, messages);
    conversation.status = status;
    Object.assign(conversation, { createdAt, updatedAt, title });
    return conversation;
  }

  addMessage(message: Message): void {
    this.validateCanAddMessage(message);

    this.messages.push(message);
    this.updatedAt = new Date();

    // Update conversation status based on message role
    if (message.getRole().isUser()) {
      this.status = ConversationStatus.WAITING_FOR_RESPONSE;
    } else if (message.getRole().isAssistant()) {
      this.status = ConversationStatus.ACTIVE;
    }

    // Auto-generate title from first user message if not set
    if (!this.title && message.getRole().isUser() && this.messages.length === 1) {
      this.generateTitle(message);
    }
  }

  private validateCanAddMessage(message: Message): void {
    // Check conversation limits
    if (this.messages.length >= this.maxMessages) {
      throw new ConversationError(
        `Conversation has reached maximum message limit of ${this.maxMessages}`,
        this.id
      );
    }

    // Check if conversation is in a valid state
    if (this.status === ConversationStatus.ARCHIVED) {
      throw new ConversationError('Cannot add messages to archived conversation', this.id);
    }

    if (this.status === ConversationStatus.COMPLETED) {
      throw new ConversationError('Cannot add messages to completed conversation', this.id);
    }

    // Check message ordering rules
    const lastMessage = this.getLastMessage();
    if (lastMessage && !message.isValidAfter(lastMessage)) {
      throw new InvalidMessageError(
        `Invalid message sequence: ${message.getRole().getValue()} cannot follow ${lastMessage
          .getRole()
          .getValue()}`
      );
    }

    // Allow tool messages when there are pending tool invocations
    // Tool messages are the resolution of pending tool invocations
    if (this.hasPendingToolInvocations() && !message.getRole().isTool() && !message.getRole().isAssistant()) {
      throw new ConversationError(
        'Cannot add non-tool message while tool invocations are pending',
        this.id
      );
    }
  }

  private generateTitle(firstUserMessage: Message): void {
    const content = firstUserMessage.getContent().getValue();
    // Take first 50 characters or until first newline
    const maxLength = 50;
    const firstLine = content.split('\n')[0];
    this.title = firstLine.length > maxLength
      ? firstLine.substring(0, maxLength) + '...'
      : firstLine;
  }

  markAsCompleted(): void {
    if (this.status === ConversationStatus.ARCHIVED) {
      throw new ConversationError('Cannot complete an archived conversation', this.id);
    }
    this.status = ConversationStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  archive(): void {
    if (this.status === ConversationStatus.ARCHIVED) {
      throw new ConversationError('Conversation is already archived', this.id);
    }
    this.status = ConversationStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  reactivate(): void {
    if (this.status !== ConversationStatus.ARCHIVED) {
      throw new ConversationError('Can only reactivate archived conversations', this.id);
    }
    this.status = ConversationStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  hasPendingToolInvocations(): boolean {
    const lastAssistantMessage = this.getLastAssistantMessage();
    if (!lastAssistantMessage) return false;

    // If no tool invocations in the last assistant message, nothing is pending
    if (!lastAssistantMessage.hasToolInvocations()) return false;

    // Check if there are tool result messages after this assistant message
    const assistantIndex = this.messages.lastIndexOf(lastAssistantMessage);
    const toolCallIds = lastAssistantMessage.getToolInvocations().map(t => t.getCallId());

    // Count tool result messages for this assistant's tool calls
    let resolvedToolCalls = 0;
    for (let i = assistantIndex + 1; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.getRole().isTool()) {
        const toolCallId = message.getMetadata('tool_call_id') as string;
        if (toolCallIds.includes(toolCallId)) {
          resolvedToolCalls++;
        }
      }
    }

    // If we have tool result messages for all tool calls, nothing is pending
    return resolvedToolCalls < toolCallIds.length;
  }

  getLastMessage(): Message | null {
    return this.messages[this.messages.length - 1] || null;
  }

  getLastUserMessage(): Message | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].getRole().isUser()) {
        return this.messages[i];
      }
    }
    return null;
  }

  getLastAssistantMessage(): Message | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].getRole().isAssistant()) {
        return this.messages[i];
      }
    }
    return null;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  getUserMessageCount(): number {
    return this.messages.filter(m => m.getRole().isUser()).length;
  }

  getAssistantMessageCount(): number {
    return this.messages.filter(m => m.getRole().isAssistant()).length;
  }

  setTitle(title: string): void {
    if (!title || typeof title !== 'string') {
      throw new ConversationError('Title must be a non-empty string', this.id);
    }
    this.title = title;
    this.updatedAt = new Date();
  }

  addMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
    this.updatedAt = new Date();
  }

  getMetadata(key: string): unknown | undefined {
    return this.metadata.get(key);
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getMessages(): readonly Message[] {
    return [...this.messages];
  }

  getStatus(): ConversationStatus {
    return this.status;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getTitle(): string | undefined {
    return this.title;
  }

  isActive(): boolean {
    return this.status === ConversationStatus.ACTIVE;
  }

  isWaitingForResponse(): boolean {
    return this.status === ConversationStatus.WAITING_FOR_RESPONSE;
  }

  isCompleted(): boolean {
    return this.status === ConversationStatus.COMPLETED;
  }

  isArchived(): boolean {
    return this.status === ConversationStatus.ARCHIVED;
  }

  toObject(): {
    id: string;
    messages: Array<any>;
    status: ConversationStatus;
    title?: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      messages: this.messages.map(m => m.toObject()),
      status: this.status,
      title: this.title,
      messageCount: this.messages.length,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}