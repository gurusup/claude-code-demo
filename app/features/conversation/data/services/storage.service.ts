// ABOUTME: Service layer for managing conversation storage in browser sessionStorage
// ABOUTME: Provides abstraction over sessionStorage operations for conversation persistence

/**
 * Storage service for managing conversation data in browser storage
 * Abstracts sessionStorage operations and provides type-safe access
 */
export class ConversationStorageService {
  private static readonly CONVERSATION_ID_KEY = 'conversationId';
  private static readonly CONVERSATION_HISTORY_KEY = 'conversationHistory';

  /**
   * Check if we're in a browser environment
   */
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  }

  /**
   * Generate a unique conversation ID
   */
  static generateConversationId(): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    return `conv-${timestamp}-${randomSuffix}`;
  }

  /**
   * Get the stored conversation ID from sessionStorage
   */
  static getConversationId(): string | null {
    if (!this.isBrowser()) return null;

    try {
      return sessionStorage.getItem(this.CONVERSATION_ID_KEY);
    } catch (error) {
      console.error('Failed to get conversation ID from storage:', error);
      return null;
    }
  }

  /**
   * Store a conversation ID in sessionStorage
   */
  static setConversationId(id: string): boolean {
    if (!this.isBrowser()) return false;

    try {
      sessionStorage.setItem(this.CONVERSATION_ID_KEY, id);
      return true;
    } catch (error) {
      console.error('Failed to set conversation ID in storage:', error);
      return false;
    }
  }

  /**
   * Get or create a conversation ID
   * If no ID exists in storage, generates a new one and stores it
   */
  static getOrCreateConversationId(): string {
    let conversationId = this.getConversationId();

    if (!conversationId) {
      conversationId = this.generateConversationId();
      this.setConversationId(conversationId);
      console.log('Created new conversation ID:', conversationId);
    } else {
      console.log('Using existing conversation ID:', conversationId);
    }

    return conversationId;
  }

  /**
   * Clear the current conversation ID from storage
   */
  static clearConversationId(): boolean {
    if (!this.isBrowser()) return false;

    try {
      sessionStorage.removeItem(this.CONVERSATION_ID_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear conversation ID from storage:', error);
      return false;
    }
  }

  /**
   * Store conversation metadata (for future use)
   */
  static setConversationMetadata(conversationId: string, metadata: Record<string, any>): boolean {
    if (!this.isBrowser()) return false;

    try {
      const key = `${this.CONVERSATION_HISTORY_KEY}_${conversationId}`;
      sessionStorage.setItem(key, JSON.stringify(metadata));
      return true;
    } catch (error) {
      console.error('Failed to store conversation metadata:', error);
      return false;
    }
  }

  /**
   * Get conversation metadata (for future use)
   */
  static getConversationMetadata(conversationId: string): Record<string, any> | null {
    if (!this.isBrowser()) return null;

    try {
      const key = `${this.CONVERSATION_HISTORY_KEY}_${conversationId}`;
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get conversation metadata:', error);
      return null;
    }
  }
}