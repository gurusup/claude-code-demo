// ABOUTME: Domain service for complex message validation logic
// ABOUTME: Encapsulates business rules that span multiple entities

import { Message } from '../entities/Message';
import { InvalidMessageError } from '../exceptions/InvalidMessageError';

export class MessageValidator {
  private readonly maxContentLength: number = 32000; // Token limit approximation
  private readonly maxAttachments: number = 10;
  private readonly maxToolInvocations: number = 10;
  private readonly allowedImageFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly maxImageSize: number = 20 * 1024 * 1024; // 20MB

  isValid(message: Message): boolean {
    try {
      this.validate(message);
      return true;
    } catch {
      return false;
    }
  }

  validate(message: Message): void {
    this.validateContent(message);
    this.validateAttachments(message);
    this.validateToolInvocations(message);
    this.validateRoleSpecificRules(message);
  }

  private validateContent(message: Message): void {
    const content = message.getContent();

    // Check content length
    if (content.getLength() > this.maxContentLength) {
      throw new InvalidMessageError(
        `Message content exceeds maximum length of ${this.maxContentLength} characters`
      );
    }

    // User and assistant messages should have content (unless they have tool invocations)
    if (message.getRole().isUser() && content.isEmpty() && !message.hasAttachments()) {
      throw new InvalidMessageError('User messages must have content or attachments');
    }

    // Assistant messages can be empty if they have tool invocations
    if (message.getRole().isAssistant() && content.isEmpty() && !message.hasToolInvocations()) {
      throw new InvalidMessageError('Assistant messages must have content or tool invocations');
    }
  }

  private validateAttachments(message: Message): void {
    const attachments = message.getAttachments();

    // Check attachment count
    if (attachments.length > this.maxAttachments) {
      throw new InvalidMessageError(
        `Message cannot have more than ${this.maxAttachments} attachments`
      );
    }

    // Only user messages can have attachments (current business rule)
    if (attachments.length > 0 && !message.getRole().isUser()) {
      throw new InvalidMessageError('Only user messages can have attachments');
    }

    // Validate each attachment
    for (const attachment of attachments) {
      this.validateAttachment(attachment);
    }
  }

  private validateAttachment(attachment: any): void {
    // Validate image attachments
    if (attachment.isImage()) {
      if (!this.allowedImageFormats.includes(attachment.getContentType())) {
        throw new InvalidMessageError(
          `Unsupported image format: ${attachment.getContentType()}`
        );
      }
    }

    // Validate URL format
    const url = attachment.getUrl();
    if (!this.isValidUrl(url) && !this.isDataUrl(url)) {
      throw new InvalidMessageError(`Invalid attachment URL: ${url}`);
    }
  }

  private validateToolInvocations(message: Message): void {
    const toolInvocations = message.getToolInvocations();

    // Check tool invocation count
    if (toolInvocations.length > this.maxToolInvocations) {
      throw new InvalidMessageError(
        `Message cannot have more than ${this.maxToolInvocations} tool invocations`
      );
    }

    // Validate tool invocation states
    for (const toolInvocation of toolInvocations) {
      // All tool invocations in a message should start as pending
      if (!toolInvocation.isPending() && !toolInvocation.isCompleted()) {
        throw new InvalidMessageError(
          `Tool invocation ${toolInvocation.getCallId()} is in invalid state for a new message`
        );
      }
    }

    // Check for duplicate tool call IDs
    const callIds = new Set<string>();
    for (const toolInvocation of toolInvocations) {
      const callId = toolInvocation.getCallId();
      if (callIds.has(callId)) {
        throw new InvalidMessageError(`Duplicate tool call ID: ${callId}`);
      }
      callIds.add(callId);
    }
  }

  private validateRoleSpecificRules(message: Message): void {
    const role = message.getRole();

    // System messages validation
    if (role.isSystem()) {
      if (message.hasAttachments()) {
        throw new InvalidMessageError('System messages cannot have attachments');
      }
      if (message.hasToolInvocations()) {
        throw new InvalidMessageError('System messages cannot have tool invocations');
      }
    }

    // Tool messages validation
    if (role.isTool()) {
      if (message.hasAttachments()) {
        throw new InvalidMessageError('Tool messages cannot have attachments');
      }
      if (message.hasToolInvocations()) {
        throw new InvalidMessageError('Tool messages cannot have tool invocations');
      }
      if (message.getContent().isEmpty()) {
        throw new InvalidMessageError('Tool messages must have content (the result)');
      }
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isDataUrl(url: string): boolean {
    return url.startsWith('data:');
  }
}