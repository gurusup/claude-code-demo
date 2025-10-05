// ABOUTME: Handles adding new messages to conversations
// ABOUTME: Validates messages and persists to repository

import { Conversation } from '../../domain/entities/Conversation';
import { Message } from '../../domain/entities/Message';
import { MessageValidator } from '../../domain/services/MessageValidator';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { MessageDto, ClientMessageDto } from '../dto/MessageDto';
import { MessageMapper } from '../mappers/MessageMapper';

export class SendMessageUseCase {
  private readonly messageValidator: MessageValidator;

  constructor(
    private readonly conversationRepository: IConversationRepository
  ) {
    this.messageValidator = new MessageValidator();
  }

  /**
   * Sends a single message to a conversation
   */
  async execute(conversationId: string, messageDto: MessageDto | ClientMessageDto): Promise<Message> {
    // Get or create conversation
    let conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      conversation = Conversation.create(conversationId);
    }

    // Convert DTO to domain entity
    const message = 'experimental_attachments' in messageDto
      ? MessageMapper.fromClientDto(messageDto as ClientMessageDto)
      : MessageMapper.fromDto(messageDto as MessageDto);

    // Validate message
    this.messageValidator.validate(message);

    // Add message to conversation (will perform additional validation)
    conversation.addMessage(message);

    // Save conversation
    await this.conversationRepository.save(conversation);

    return message;
  }

  /**
   * Sends multiple messages to a conversation
   */
  async executeMultiple(
    conversationId: string,
    messageDtos: Array<MessageDto | ClientMessageDto>
  ): Promise<Message[]> {
    // Get or create conversation
    let conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      conversation = Conversation.create(conversationId);
    }

    const messages: Message[] = [];

    for (const dto of messageDtos) {
      // Convert DTO to domain entity
      const message = 'experimental_attachments' in dto
        ? MessageMapper.fromClientDto(dto as ClientMessageDto)
        : MessageMapper.fromDto(dto as MessageDto);

      // Validate message
      this.messageValidator.validate(message);

      // Add message to conversation
      conversation.addMessage(message);
      messages.push(message);
    }

    // Save conversation
    await this.conversationRepository.save(conversation);

    return messages;
  }

  /**
   * Validates if a message can be added without actually adding it
   */
  async canSendMessage(
    conversationId: string,
    messageDto: MessageDto | ClientMessageDto
  ): Promise<boolean> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      return true; // New conversation
    }

    try {
      // Convert DTO to domain entity
      const message = 'experimental_attachments' in messageDto
        ? MessageMapper.fromClientDto(messageDto as ClientMessageDto)
        : MessageMapper.fromDto(messageDto as MessageDto);

      // Validate message
      this.messageValidator.validate(message);

      // Check if it can be added to conversation
      const lastMessage = conversation.getLastMessage();
      if (lastMessage && !message.isValidAfter(lastMessage)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}