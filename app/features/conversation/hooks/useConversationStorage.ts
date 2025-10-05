// ABOUTME: Custom hook for managing conversation storage state
// ABOUTME: Provides reactive state management for conversation IDs with sessionStorage persistence

import { useState, useEffect, useCallback } from 'react';
import { ConversationStorageService } from '../data/services/storage.service';

/**
 * Hook for managing conversation storage
 * Provides reactive state and operations for conversation IDs
 */
export function useConversationStorage() {
  // Initialize state with stored ID or generate new one
  const [conversationId, setConversationId] = useState<string>(() => {
    return ConversationStorageService.getOrCreateConversationId();
  });

  // Sync state with storage on mount
  useEffect(() => {
    const storedId = ConversationStorageService.getConversationId();
    if (storedId && storedId !== conversationId) {
      setConversationId(storedId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // We only want this to run once on mount, not when conversationId changes

  /**
   * Generate a new conversation ID
   */
  const generateNewId = useCallback(() => {
    return ConversationStorageService.generateConversationId();
  }, []);

  /**
   * Create a new conversation and update storage
   */
  const startNewConversation = useCallback(() => {
    const newId = generateNewId();
    ConversationStorageService.setConversationId(newId);
    setConversationId(newId);
    console.log('Started new conversation:', newId);
    return newId;
  }, [generateNewId]);

  /**
   * Clear the current conversation
   */
  const clearConversation = useCallback(() => {
    ConversationStorageService.clearConversationId();
    const newId = generateNewId();
    setConversationId(newId);
    return newId;
  }, [generateNewId]);

  /**
   * Load a specific conversation by ID
   */
  const loadConversation = useCallback((id: string) => {
    ConversationStorageService.setConversationId(id);
    setConversationId(id);
    console.log('Loaded conversation:', id);
  }, []);

  /**
   * Check if a conversation ID exists in storage
   */
  const hasStoredConversation = useCallback(() => {
    return ConversationStorageService.getConversationId() !== null;
  }, []);

  /**
   * Get conversation metadata
   */
  const getMetadata = useCallback((id?: string) => {
    const targetId = id || conversationId;
    return ConversationStorageService.getConversationMetadata(targetId);
  }, [conversationId]);

  /**
   * Set conversation metadata
   */
  const setMetadata = useCallback((metadata: Record<string, any>, id?: string) => {
    const targetId = id || conversationId;
    return ConversationStorageService.setConversationMetadata(targetId, metadata);
  }, [conversationId]);

  return {
    conversationId,
    startNewConversation,
    clearConversation,
    loadConversation,
    hasStoredConversation,
    getMetadata,
    setMetadata,
  };
}