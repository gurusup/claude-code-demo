// ABOUTME: Repository interface for conversation persistence
// ABOUTME: Defined in domain layer, implemented in infrastructure

import { Conversation } from '../entities/Conversation';

export interface IConversationRepository {
  /**
   * Finds a conversation by ID
   */
  findById(id: string): Promise<Conversation | null>;

  /**
   * Saves a conversation (create or update)
   */
  save(conversation: Conversation): Promise<void>;

  /**
   * Deletes a conversation
   */
  delete(id: string): Promise<void>;

  /**
   * Lists all conversations with optional filtering
   */
  findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Conversation[]>;

  /**
   * Finds conversations by user (if user tracking is implemented)
   */
  findByUser?(userId: string): Promise<Conversation[]>;

  /**
   * Counts total conversations
   */
  count(): Promise<number>;

  /**
   * Finds active conversations
   */
  findActive(): Promise<Conversation[]>;

  /**
   * Archives old conversations
   */
  archiveOlderThan?(date: Date): Promise<number>;
}