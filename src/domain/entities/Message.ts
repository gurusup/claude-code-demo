// ABOUTME: Domain entity representing a single message in a conversation
// ABOUTME: Encapsulates validation logic for message structure and relationships

import { MessageRole } from '../value-objects/MessageRole';
import { MessageContent } from '../value-objects/MessageContent';
import { Attachment } from '../value-objects/Attachment';
import { ToolInvocation } from './ToolInvocation';
import { InvalidMessageError } from '../exceptions/InvalidMessageError';
import { randomUUID } from 'crypto';

export class Message {
  private readonly id: string;
  private readonly role: MessageRole;
  private readonly content: MessageContent;
  private readonly attachments: Attachment[];
  private readonly toolInvocations: ToolInvocation[];
  private readonly timestamp: Date;
  private readonly metadata: Map<string, unknown>;

  private constructor(
    id: string,
    role: MessageRole,
    content: MessageContent,
    attachments: Attachment[],
    toolInvocations: ToolInvocation[],
    metadata?: Map<string, unknown>
  ) {
    this.id = id;
    this.role = role;
    this.content = content;
    this.attachments = [...attachments]; // Defensive copy
    this.toolInvocations = [...toolInvocations]; // Defensive copy
    this.timestamp = new Date();
    this.metadata = metadata || new Map();

    this.validate();
  }

  static create(
    role: MessageRole,
    content: MessageContent,
    attachments: Attachment[] = [],
    toolInvocations: ToolInvocation[] = []
  ): Message {
    const id = randomUUID();
    return new Message(id, role, content, attachments, toolInvocations);
  }

  static createWithId(
    id: string,
    role: MessageRole,
    content: MessageContent,
    attachments: Attachment[] = [],
    toolInvocations: ToolInvocation[] = []
  ): Message {
    if (!id || typeof id !== 'string') {
      throw new InvalidMessageError('Message ID must be a non-empty string');
    }
    return new Message(id, role, content, attachments, toolInvocations);
  }

  static createToolMessage(
    toolCallId: string,
    content: string
  ): Message {
    const id = randomUUID();
    const role = MessageRole.tool();
    const messageContent = MessageContent.from(content);
    const message = new Message(id, role, messageContent, [], []);

    // Add tool call ID as metadata
    message.addMetadata('tool_call_id', toolCallId);

    return message;
  }

  private validate(): void {
    // Tool messages should have non-empty content (the result)
    if (this.role.isTool() && this.content.isEmpty()) {
      throw new InvalidMessageError('Tool messages must have non-empty content');
    }

    // System messages shouldn't have tool invocations
    if (this.role.isSystem() && this.toolInvocations.length > 0) {
      throw new InvalidMessageError('System messages cannot have tool invocations');
    }

    // Only assistant messages can have tool invocations
    if (this.toolInvocations.length > 0 && !this.role.isAssistant()) {
      throw new InvalidMessageError('Only assistant messages can have tool invocations');
    }
  }

  isValidAfter(previousMessage: Message): boolean {
    // Business rule: tool messages must follow assistant messages with tool calls
    if (this.role.isTool()) {
      return previousMessage.hasToolInvocations();
    }

    // Business rule: consecutive messages from same role are generally invalid
    // Exception: system messages can be consecutive
    if (!this.role.isSystem() && !previousMessage.role.isSystem()) {
      if (this.role.equals(previousMessage.role)) {
        return false;
      }
    }

    return true;
  }

  hasToolInvocations(): boolean {
    return this.toolInvocations.length > 0;
  }

  hasAttachments(): boolean {
    return this.attachments.length > 0;
  }

  hasImageAttachments(): boolean {
    return this.attachments.some(a => a.isImage());
  }

  getActiveToolInvocations(): ToolInvocation[] {
    return this.toolInvocations.filter(t => t.isExecuting());
  }

  getPendingToolInvocations(): ToolInvocation[] {
    return this.toolInvocations.filter(t => t.isPending());
  }

  getCompletedToolInvocations(): ToolInvocation[] {
    return this.toolInvocations.filter(t => t.isCompleted());
  }

  allToolInvocationsComplete(): boolean {
    return this.toolInvocations.every(t => t.isFinished());
  }

  addMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  getMetadata(key: string): unknown | undefined {
    return this.metadata.get(key);
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getRole(): MessageRole {
    return this.role;
  }

  getContent(): MessageContent {
    return this.content;
  }

  getAttachments(): readonly Attachment[] {
    return [...this.attachments];
  }

  getToolInvocations(): readonly ToolInvocation[] {
    return [...this.toolInvocations];
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  toObject(): {
    id: string;
    role: string;
    content: string;
    attachments: Array<{ name: string; contentType: string; url: string }>;
    toolInvocations: Array<any>;
    timestamp: string;
    metadata?: Record<string, unknown>;
  } {
    return {
      id: this.id,
      role: this.role.getValue(),
      content: this.content.getValue(),
      attachments: this.attachments.map(a => a.toObject()),
      toolInvocations: this.toolInvocations.map(t => t.toObject()),
      timestamp: this.timestamp.toISOString(),
      // Include metadata if it has any entries
      ...(this.metadata.size > 0 && { metadata: Object.fromEntries(this.metadata) }),
    };
  }
}