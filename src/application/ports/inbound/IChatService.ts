// ABOUTME: Primary port for chat operations defining the application's use cases
// ABOUTME: Framework-agnostic interface for chat completion functionality

import { Message } from '../../../domain/entities/Message';
import { Conversation } from '../../../domain/entities/Conversation';
import { StreamingResponse, StreamChunk, TokenUsage } from '../../../domain/entities/StreamingResponse';

export interface IChatService {
  /**
   * Sends a message and streams the AI response
   */
  streamChatCompletion(
    conversationId: string,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (usage: TokenUsage) => void,
    onError: (error: Error) => void
  ): Promise<void>;

  /**
   * Creates a new conversation
   */
  createConversation(): Promise<Conversation>;

  /**
   * Adds a message to a conversation
   */
  addMessageToConversation(
    conversationId: string,
    message: Message
  ): Promise<void>;

  /**
   * Gets a conversation by ID
   */
  getConversation(conversationId: string): Promise<Conversation | null>;

  /**
   * Lists all conversations
   */
  listConversations(): Promise<Conversation[]>;

  /**
   * Archives a conversation
   */
  archiveConversation(conversationId: string): Promise<void>;
}