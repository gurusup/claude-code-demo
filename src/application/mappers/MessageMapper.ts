// ABOUTME: Maps between domain Message entities and DTOs
// ABOUTME: Handles conversion logic and data transformation

import { Message } from '../../domain/entities/Message';
import { ToolInvocation, ToolInvocationState } from '../../domain/entities/ToolInvocation';
import { MessageRole } from '../../domain/value-objects/MessageRole';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { Attachment } from '../../domain/value-objects/Attachment';
import { ToolName } from '../../domain/value-objects/ToolName';
import { MessageDto, ClientMessageDto, ToolInvocationDto, AttachmentDto } from '../dto/MessageDto';

export class MessageMapper {
  /**
   * Converts domain Message to DTO
   */
  static toDto(message: Message): MessageDto {
    return {
      id: message.getId(),
      role: message.getRole().getValue(),
      content: message.getContent().getValue(),
      attachments: message.getAttachments().map(a => this.attachmentToDto(a)),
      toolInvocations: message.getToolInvocations().map(t => this.toolInvocationToDto(t)),
      timestamp: message.getTimestamp().toISOString(),
    };
  }

  /**
   * Converts DTO to domain Message
   */
  static fromDto(dto: MessageDto): Message {
    const role = MessageRole.from(dto.role);
    const content = MessageContent.from(dto.content);

    const attachments = (dto.attachments || []).map(a =>
      Attachment.create(a.name, a.contentType, a.url)
    );

    const toolInvocations = (dto.toolInvocations || []).map(t =>
      ToolInvocation.create(
        t.toolCallId,
        ToolName.from(t.toolName),
        t.args
      )
    );

    if (dto.id) {
      return Message.createWithId(dto.id, role, content, attachments, toolInvocations);
    }
    return Message.create(role, content, attachments, toolInvocations);
  }

  /**
   * Converts ClientMessageDto to domain Message
   */
  static fromClientDto(dto: ClientMessageDto): Message {
    const role = MessageRole.from(dto.role);
    const content = MessageContent.from(dto.content);

    const attachments = (dto.experimental_attachments || []).map(a =>
      Attachment.create(a.name, a.contentType, a.url)
    );

    const toolInvocations = (dto.toolInvocations || []).map(t =>
      ToolInvocation.create(
        t.toolCallId,
        ToolName.from(t.toolName),
        t.args
      )
    );

    return Message.create(role, content, attachments, toolInvocations);
  }

  /**
   * Converts array of domain Messages to DTOs
   */
  static toDtoArray(messages: readonly Message[]): MessageDto[] {
    return messages.map(m => this.toDto(m));
  }

  /**
   * Converts array of DTOs to domain Messages
   */
  static fromDtoArray(dtos: MessageDto[]): Message[] {
    return dtos.map(dto => this.fromDto(dto));
  }

  /**
   * Converts array of ClientMessageDtos to domain Messages
   */
  static fromClientDtoArray(dtos: ClientMessageDto[]): Message[] {
    return dtos.map(dto => this.fromClientDto(dto));
  }

  private static attachmentToDto(attachment: Attachment): AttachmentDto {
    return attachment.toObject();
  }

  private static toolInvocationToDto(toolInvocation: ToolInvocation): ToolInvocationDto {
    const state = toolInvocation.getState();
    let dtoState: 'call' | 'partial-call' | 'result';

    if (state === ToolInvocationState.COMPLETED) {
      dtoState = 'result';
    } else if (state === ToolInvocationState.EXECUTING) {
      dtoState = 'partial-call';
    } else {
      dtoState = 'call';
    }

    return {
      state: dtoState,
      toolCallId: toolInvocation.getCallId(),
      toolName: toolInvocation.getToolName().getValue(),
      args: toolInvocation.getArgs(),
      result: toolInvocation.getResult(),
    };
  }
}