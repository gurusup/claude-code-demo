// ABOUTME: Maps between domain Conversation entities and DTOs
// ABOUTME: Handles conversation-level data transformation

import { Conversation, ConversationStatus } from '../../domain/entities/Conversation';
import { ConversationDto } from '../dto/ConversationDto';
import { MessageMapper } from './MessageMapper';

export class ConversationMapper {
  /**
   * Converts domain Conversation to DTO
   */
  static toDto(conversation: Conversation): ConversationDto {
    return {
      id: conversation.getId(),
      title: conversation.getTitle(),
      messages: MessageMapper.toDtoArray(conversation.getMessages()),
      status: this.mapStatus(conversation.getStatus()),
      messageCount: conversation.getMessageCount(),
      createdAt: conversation.getCreatedAt().toISOString(),
      updatedAt: conversation.getUpdatedAt().toISOString(),
    };
  }

  /**
   * Creates a summary DTO without messages
   */
  static toSummaryDto(conversation: Conversation): Omit<ConversationDto, 'messages'> & { messages?: [] } {
    return {
      id: conversation.getId(),
      title: conversation.getTitle(),
      messages: [],
      status: this.mapStatus(conversation.getStatus()),
      messageCount: conversation.getMessageCount(),
      createdAt: conversation.getCreatedAt().toISOString(),
      updatedAt: conversation.getUpdatedAt().toISOString(),
    };
  }

  /**
   * Converts array of domain Conversations to DTOs
   */
  static toDtoArray(conversations: Conversation[]): ConversationDto[] {
    return conversations.map(c => this.toDto(c));
  }

  /**
   * Converts array of domain Conversations to summary DTOs
   */
  static toSummaryDtoArray(conversations: Conversation[]): ConversationDto[] {
    return conversations.map(c => ({
      ...this.toSummaryDto(c),
      messages: [] // Provide empty array to satisfy ConversationDto interface
    }));
  }

  private static mapStatus(status: ConversationStatus): 'active' | 'waiting_for_response' | 'completed' | 'archived' {
    switch (status) {
      case ConversationStatus.ACTIVE:
        return 'active';
      case ConversationStatus.WAITING_FOR_RESPONSE:
        return 'waiting_for_response';
      case ConversationStatus.COMPLETED:
        return 'completed';
      case ConversationStatus.ARCHIVED:
        return 'archived';
      default:
        return 'active';
    }
  }
}