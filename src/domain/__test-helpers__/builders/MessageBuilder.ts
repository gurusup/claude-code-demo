// ABOUTME: Fluent builder for constructing test messages with flexible configuration
// ABOUTME: Provides chainable methods for customizing message properties

import { Message } from '../../entities/Message';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';
import { Attachment } from '../../value-objects/Attachment';
import { ToolInvocation } from '../../entities/ToolInvocation';

export class MessageBuilder {
  private id?: string;
  private role: MessageRole = MessageRole.user();
  private content: MessageContent = MessageContent.from('test message');
  private attachments: Attachment[] = [];
  private toolInvocations: ToolInvocation[] = [];

  /**
   * Set a specific message ID
   */
  withId(id: string): this {
    this.id = id;
    return this;
  }

  /**
   * Set the message role
   */
  withRole(role: MessageRole): this {
    this.role = role;
    return this;
  }

  /**
   * Set as user message
   */
  asUser(): this {
    this.role = MessageRole.user();
    return this;
  }

  /**
   * Set as assistant message
   */
  asAssistant(): this {
    this.role = MessageRole.assistant();
    return this;
  }

  /**
   * Set as system message
   */
  asSystem(): this {
    this.role = MessageRole.system();
    return this;
  }

  /**
   * Set as tool message
   */
  asTool(): this {
    this.role = MessageRole.tool();
    return this;
  }

  /**
   * Set the message content
   */
  withContent(content: string | MessageContent): this {
    this.content = typeof content === 'string' ? MessageContent.from(content) : content;
    return this;
  }

  /**
   * Set empty content
   */
  withEmptyContent(): this {
    this.content = MessageContent.empty();
    return this;
  }

  /**
   * Add an attachment
   */
  withAttachment(name: string, contentType: string, url: string): this {
    this.attachments.push(Attachment.create(name, contentType, url));
    return this;
  }

  /**
   * Add multiple attachments
   */
  withAttachments(attachments: Attachment[]): this {
    this.attachments = [...attachments];
    return this;
  }

  /**
   * Add an image attachment
   */
  withImageAttachment(name: string = 'image.png'): this {
    return this.withAttachment(name, 'image/png', `https://example.com/${name}`);
  }

  /**
   * Add a tool invocation
   */
  withToolInvocation(toolInvocation: ToolInvocation): this {
    this.toolInvocations.push(toolInvocation);
    return this;
  }

  /**
   * Add multiple tool invocations
   */
  withToolInvocations(toolInvocations: ToolInvocation[]): this {
    this.toolInvocations = [...toolInvocations];
    return this;
  }

  /**
   * Build the message
   */
  build(): Message {
    if (this.id) {
      return Message.createWithId(
        this.id,
        this.role,
        this.content,
        this.attachments,
        this.toolInvocations
      );
    }

    return Message.create(
      this.role,
      this.content,
      this.attachments,
      this.toolInvocations
    );
  }

  /**
   * Reset the builder to default values
   */
  reset(): this {
    this.id = undefined;
    this.role = MessageRole.user();
    this.content = MessageContent.from('test message');
    this.attachments = [];
    this.toolInvocations = [];
    return this;
  }
}
