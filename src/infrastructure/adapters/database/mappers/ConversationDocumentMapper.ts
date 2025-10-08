// ABOUTME: Maps between Conversation domain entities and MongoDB documents.
// ABOUTME: Handles bidirectional conversion with proper value object reconstruction.

import { Conversation, ConversationStatus } from "@/domain/entities/Conversation";
import { Message } from "@/domain/entities/Message";
import { MessageRole } from "@/domain/value-objects/MessageRole";
import { MessageContent } from "@/domain/value-objects/MessageContent";
import { Attachment } from "@/domain/value-objects/Attachment";
import { ToolInvocation } from "@/domain/entities/ToolInvocation";
import { ToolName } from "@/domain/value-objects/ToolName";
import {
  ConversationDocument,
  MessageDocument,
  AttachmentDocument,
  ToolInvocationDocument,
} from "../types/ConversationDocument";

export class ConversationDocumentMapper {
  /**
   * Converts a Conversation entity to a MongoDB document.
   */
  static toDocument(conversation: Conversation): ConversationDocument {
    const messages = conversation.getMessages().map((msg) => ConversationDocumentMapper.messageToDocument(msg));

    return {
      _id: conversation.getId(),
      title: conversation.getTitle() || "",
      status: conversation.getStatus(),
      messages,
      createdAt: conversation.getCreatedAt(),
      updatedAt: conversation.getUpdatedAt(),
    };
  }

  /**
   * Converts a MongoDB document to a Conversation entity.
   * Uses Conversation.restore() to bypass domain validation for historical data.
   */
  static toEntity(document: ConversationDocument): Conversation {
    const messages = document.messages.map((doc) => ConversationDocumentMapper.documentToMessage(doc));

    return Conversation.restore(
      document._id,
      messages,
      document.status as ConversationStatus,
      document.createdAt,
      document.updatedAt,
      document.title || undefined
    );
  }

  private static messageToDocument(message: Message): MessageDocument {
    const attachments = message
      .getAttachments()
      .map((attachment) => ConversationDocumentMapper.attachmentToDocument(attachment));

    const toolInvocations = message
      .getToolInvocations()
      .map((invocation) => ConversationDocumentMapper.toolInvocationToDocument(invocation));

    return {
      id: message.getId(),
      role: message.getRole().getValue(),
      content: message.getContent().getValue(),
      createdAt: message.getTimestamp(),
      attachments: attachments.length > 0 ? attachments : undefined,
      toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    };
  }

  private static documentToMessage(document: MessageDocument): Message {
    const role = MessageRole.from(document.role);
    const content = MessageContent.from(document.content);

    const attachments =
      document.attachments?.map((att) => ConversationDocumentMapper.documentToAttachment(att)) || [];

    const toolInvocations =
      document.toolInvocations?.map((inv) => ConversationDocumentMapper.documentToToolInvocation(inv)) || [];

    return Message.createWithId(
      document.id,
      role,
      content,
      attachments,
      toolInvocations
    );
  }

  private static attachmentToDocument(attachment: Attachment): AttachmentDocument {
    return {
      name: attachment.getName(),
      contentType: attachment.getContentType(),
      url: attachment.getUrl(),
    };
  }

  private static documentToAttachment(document: AttachmentDocument): Attachment {
    return Attachment.create(
      document.name,
      document.contentType,
      document.url
    );
  }

  private static toolInvocationToDocument(
    invocation: ToolInvocation
  ): ToolInvocationDocument {
    return {
      toolCallId: invocation.getCallId(),
      toolName: invocation.getToolName().getValue(),
      args: invocation.getArgs(),
      state: invocation.getState(),
      result: invocation.getResult() as string | undefined,
    };
  }

  private static documentToToolInvocation(
    document: ToolInvocationDocument
  ): ToolInvocation {
    const toolName = ToolName.from(document.toolName);

    const invocation = ToolInvocation.create(
      document.toolCallId,
      toolName,
      document.args
    );

    // Manually replay state transitions based on the stored state
    if (document.state === "executing") {
      invocation.markAsExecuting();
    } else if (document.state === "completed" && document.result) {
      invocation.markAsExecuting();
      invocation.complete(document.result);
    } else if (document.state === "failed" && document.result) {
      invocation.markAsExecuting();
      const error = new Error(document.result);
      invocation.fail(error);
    }

    return invocation;
  }
}
