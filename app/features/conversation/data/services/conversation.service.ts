// ABOUTME: Service layer for conversation API communication
// ABOUTME: Handles HTTP requests for conversation management and history retrieval

import axios, { AxiosInstance } from 'axios';
import { Message } from 'ai';

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
  });

  /**
   * Fetch conversation history by ID
   * This can be used to restore previous conversations
   */
  static async getConversationHistory(conversationId: string): Promise<Message[]> {
    try {
      const response = await this.axiosInstance.get(`/conversations/${conversationId}/messages`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversation history:', error);
      // Return empty array as fallback for now
      // In production, you might want to handle this differently
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
   * Delete a conversation by ID
   */
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      await this.axiosInstance.delete(`/conversations/${conversationId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
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
   * Get all conversations for the current user
   * This could be used for a conversation history sidebar
   */
  static async listConversations(): Promise<Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, any>;
  }>> {
    try {
      const response = await this.axiosInstance.get('/conversations');
      return response.data;
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
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