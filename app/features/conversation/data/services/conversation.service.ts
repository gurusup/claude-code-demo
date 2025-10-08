// ABOUTME: Service layer for conversation API communication
// ABOUTME: Handles HTTP requests for conversation management and history retrieval

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Message } from 'ai';

export class ConversationServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ConversationServiceError';
  }
}

export interface ConversationListItem {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  status: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversation service for API communication
 * Handles all conversation-related HTTP requests
 */
export class ConversationService {
  private static axiosInstance: AxiosInstance = axios.create({
    baseURL: '/api',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10s default timeout
  });

  private static handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{error?: string}>;
      const statusCode = axiosError.response?.status;
      const message = axiosError.response?.data?.error || axiosError.message;

      throw new ConversationServiceError(
        `${operation} failed: ${message}`,
        statusCode,
        error
      );
    }

    throw new ConversationServiceError(
      `${operation} failed: ${(error as Error).message}`,
      undefined,
      error as Error
    );
  }

  /**
   * List all conversations with optional filtering
   */
  static async listConversations(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ConversationListItem[]> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await this.axiosInstance.get<{
        conversations: ConversationListItem[];
      }>(`/conversations/list?${params.toString()}`);

      return response.data.conversations;
    } catch (error) {
      this.handleError(error, 'List conversations');
    }
  }

  /**
   * Get full conversation details with messages
   */
  static async getConversationById(
    conversationId: string
  ): Promise<ConversationDetail> {
    try {
      const response = await this.axiosInstance.get<ConversationDetail>(
        `/conversations/${conversationId}`,
        { timeout: 30000 } // Extended timeout for large conversations
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Get conversation');
    }
  }

  /**
   * Fetch conversation messages by ID (legacy compatibility)
   * @deprecated Use getConversationById instead
   */
  static async getConversationHistory(conversationId: string): Promise<Message[]> {
    try {
      const conversation = await this.getConversationById(conversationId);
      return conversation.messages;
    } catch (error) {
      console.error('Failed to fetch conversation history:', error);
      return [];
    }
  }

  /**
   * Create a new conversation
   * Returns the created conversation ID
   */
  static async createConversation(metadata?: Record<string, any>): Promise<string> {
    try {
      const response = await this.axiosInstance.post('/conversations', {
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
      });
      return response.data.conversationId;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation by ID (hard delete)
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/conversations/${conversationId}`);
    } catch (error) {
      this.handleError(error, 'Delete conversation');
    }
  }

  /**
   * Update conversation metadata
   */
  static async updateConversationMetadata(
    conversationId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      await this.axiosInstance.patch(`/conversations/${conversationId}`, {
        metadata,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Failed to update conversation metadata:', error);
      return false;
    }
  }


  /**
   * Archive a conversation
   * Keeps the conversation but marks it as archived
   */
  static async archiveConversation(conversationId: string): Promise<boolean> {
    try {
      await this.axiosInstance.post(`/conversations/${conversationId}/archive`);
      return true;
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      return false;
    }
  }
}