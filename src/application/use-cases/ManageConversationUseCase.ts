// ABOUTME: Handles conversation lifecycle management operations
// ABOUTME: Create, archive, delete, and query conversations

import { Conversation } from '../../domain/entities/Conversation';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { ConversationOrchestrator } from '../../domain/services/ConversationOrchestrator';
import { ConversationDto } from '../dto/ConversationDto';
import { ConversationMapper } from '../mappers/ConversationMapper';

export class ManageConversationUseCase {
  private readonly orchestrator: ConversationOrchestrator;

  constructor(
    private readonly conversationRepository: IConversationRepository
  ) {
    this.orchestrator = new ConversationOrchestrator();
  }

  /**
   * Creates a new conversation
   */
  async createConversation(title?: string): Promise<Conversation> {
    const conversation = Conversation.create();

    if (title) {
      conversation.setTitle(title);
    }

    await this.conversationRepository.save(conversation);
    return conversation;
  }

  /**
   * Creates a new conversation with a specific ID
   */
  async createConversationWithId(id: string, title?: string): Promise<Conversation> {
    const conversation = Conversation.create(id);

    if (title) {
      conversation.setTitle(title);
    }

    await this.conversationRepository.save(conversation);
    return conversation;
  }

  /**
   * Gets a conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepository.findById(conversationId);
  }

  /**
   * Lists all conversations
   */
  async listConversations(options?: {
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  }): Promise<ConversationDto[]> {
    const conversations = await this.conversationRepository.findAll({
      limit: options?.limit,
      offset: options?.offset,
      status: options?.includeArchived ? undefined : 'active',
    });

    return ConversationMapper.toSummaryDtoArray(conversations);
  }

  /**
   * Archives a conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.archive();
    await this.conversationRepository.save(conversation);
  }

  /**
   * Reactivates an archived conversation
   */
  async reactivateConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.reactivate();
    await this.conversationRepository.save(conversation);
  }

  /**
   * Deletes a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.conversationRepository.delete(conversationId);
  }

  /**
   * Updates conversation title
   */
  async updateTitle(conversationId: string, title: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.setTitle(title);
    await this.conversationRepository.save(conversation);
  }

  /**
   * Gets conversation metrics
   */
  async getConversationMetrics(conversationId: string): Promise<{
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    toolInvocationCount: number;
    averageResponseLength: number;
    hasActiveTools: boolean;
  }> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return this.orchestrator.calculateMetrics(conversation);
  }

  /**
   * Validates conversation integrity
   */
  async validateConversation(conversationId: string): Promise<{
    isValid: boolean;
    errors?: string[];
  }> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      return { isValid: false, errors: ['Conversation not found'] };
    }

    try {
      this.orchestrator.validateConversationIntegrity(conversation);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Gets next suggested action for conversation
   */
  async getNextAction(conversationId: string): Promise<string> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return this.orchestrator.suggestNextAction(conversation);
  }
}