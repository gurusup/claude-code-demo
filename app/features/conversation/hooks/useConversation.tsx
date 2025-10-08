// ABOUTME: Main business hook for conversation management
// ABOUTME: Orchestrates chat functionality by wrapping Vercel AI SDK with business logic

import { useChat } from 'ai/react';
import { toast } from 'sonner';
import { useConversationStorage } from './useConversationStorage';
import { useCallback, useEffect, useState } from 'react';
import { ConversationService } from '../data/services/conversation.service';
import { useQueryClient } from '@tanstack/react-query';
import { conversationKeys } from './queries/useConversationQuery';
import type { Message } from 'ai';

export interface UseConversationOptions {
  /**
   * Initial messages to load
   */
  initialMessages?: Message[];
  /**
   * Maximum number of steps for tool calls
   */
  maxSteps?: number;
  /**
   * Callback when conversation starts
   */
  onConversationStart?: (conversationId: string) => void;
  /**
   * Callback when new conversation is created
   */
  onNewConversation?: (conversationId: string) => void;
  /**
   * Custom error handler
   */
  onError?: (error: Error) => void;
}

/**
 * Main business hook for conversation management
 * Wraps Vercel AI SDK's useChat with additional business logic
 */
export function useConversation(options: UseConversationOptions = {}) {
  const {
    initialMessages = [],
    maxSteps,
    onConversationStart,
    onNewConversation,
    onError,
  } = options;

  // Manage conversation storage
  const storage = useConversationStorage();

  // Get query client for cache invalidation
  const queryClient = useQueryClient();

  // Log component lifecycle
  useEffect(() => {
    console.log('useConversation hook initialized with conversationId:', storage.conversationId);
    return () => {
      console.log('useConversation hook cleanup');
    };
  }, [storage.conversationId]);

  // Default error handler
  const handleError = useCallback((error: Error) => {
    console.error('Chat error:', error);

    // Custom error handler
    if (onError) {
      onError(error);
      return;
    }

    // Default error handling
    if (error.message.includes('Too many requests')) {
      toast.error('You are sending too many messages. Please try again later.');
    } else if (error.message.includes('Network')) {
      toast.error('Network error. Please check your connection.');
    } else if (error.message.includes('Unauthorized')) {
      toast.error('Authentication error. Please refresh the page.');
    } else {
      toast.error('An error occurred. Please try again.');
    }
  }, [onError]);

  // Initialize Vercel AI SDK's useChat
  const {
    messages,
    setMessages,
    input,
    setInput,
    append,
    reload,
    stop,
    isLoading,
    error,
    data,
    handleSubmit: originalHandleSubmit,
    handleInputChange,
  } = useChat({
    id: storage.conversationId, // Use id to make useChat reactive to conversation changes
    initialMessages,
    api: '/api/conversations',
    maxSteps,
    body: {
      conversationId: storage.conversationId,
    },
    onError: handleError,
    onFinish: async (message:Message) => {
      console.log('[useConversation] Stream finished:', message);

      // Update conversation metadata
      storage.setMetadata({
        lastMessageAt: new Date().toISOString(),
        messageCount: messages.length + 1,
      });

      // Invalidate conversation list cache to show the new/updated conversation
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

      // Refetch the conversation from the server to ensure UI is in sync with DB
      try {
        console.log('[useConversation] Refetching conversation to sync with DB...');
        const conversation = await ConversationService.getConversationById(storage.conversationId);
        console.log('[useConversation] Refetched conversation with', conversation.messages.length, 'messages');

        // Update messages with the server state
        setMessages(conversation.messages);
      } catch (error) {
        console.error('[useConversation] Failed to refetch conversation:', error);
        // Don't show error to user - the streaming already worked
      }
    },
  });

  /**
   * Start a new conversation
   */
  const startNewConversation = useCallback(() => {
    const newId = storage.startNewConversation();
    setMessages([]);
    setInput('');

    console.log('Started new conversation:', newId);

    if (onNewConversation) {
      onNewConversation(newId);
    }

    return newId;
  }, [storage, setMessages, setInput, onNewConversation]);

  /**
   * Enhanced handleSubmit that includes conversation start tracking
   * Wraps the original handleSubmit to handle type differences
   */
  const handleSubmit = useCallback((
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: any
  ) => {
    // Track conversation start if this is the first message
    if (messages.length === 0 && onConversationStart) {
      onConversationStart(storage.conversationId);
    }
    // Call original handleSubmit - it accepts both signatures
    originalHandleSubmit(event as any, chatRequestOptions);
  }, [messages.length, onConversationStart, storage.conversationId, originalHandleSubmit]);

  /**
   * Clear all messages in current conversation
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    console.log('Cleared messages for conversation:', storage.conversationId);
  }, [setMessages, storage.conversationId]);

  /**
   * Load conversation state for loading a conversation
   */
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  /**
   * Load a specific conversation by ID
   */
  const loadConversation = useCallback(
    async (conversationId: string) => {
      try {
        setIsLoadingConversation(true);
        setLoadError(null);

        console.log('Loading conversation:', conversationId);

        // Clear current messages
        setMessages([]);

        // Update storage to new conversation ID
        storage.loadConversation(conversationId);

        // Fetch conversation from API
        const conversation = await ConversationService.getConversationById(conversationId);

        // Set messages from conversation history
        setMessages(conversation.messages);

        console.log(
          `Loaded conversation ${conversationId} with ${conversation.messages.length} messages`
        );

      } catch (error) {
        const err = error as Error;
        console.error('Failed to load conversation:', err);
        setLoadError(err);

        // User-friendly error messages
        if (err.message.includes('404') || err.message.includes('not found')) {
          toast.error('Conversation not found');
        } else if (err.message.includes('Network')) {
          toast.error('Network error. Please check your connection.');
        } else {
          toast.error('Failed to load conversation');
        }
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [storage, setMessages]
  );

  /**
   * Clear load error
   */
  const clearLoadError = useCallback(() => {
    setLoadError(null);
  }, []);

  /**
   * Check if conversation has messages
   */
  const hasMessages = messages.length > 0;

  /**
   * Check if conversation is empty
   */
  const isEmpty = messages.length === 0;

  /**
   * Get the last message
   */
  const lastMessage = messages[messages.length - 1];

  /**
   * Check if the last message is from the user
   */
  const isUserLastMessage = lastMessage?.role === 'user';

  /**
   * Check if the assistant is currently thinking
   */
  const isThinking = isLoading && isUserLastMessage;

  return {
    // Conversation state
    conversationId: storage.conversationId,
    messages,
    input,
    isLoading,
    error,
    data,

    // Derived state
    hasMessages,
    isEmpty,
    lastMessage,
    isUserLastMessage,
    isThinking,

    // Loading state
    isLoadingConversation,
    loadError,

    // Message operations
    setMessages,
    setInput,
    append,
    reload,
    stop,
    clearMessages,

    // Form handlers
    handleSubmit,
    handleInputChange,

    // Conversation operations
    startNewConversation,
    loadConversation,
    clearLoadError,

    // Storage operations
    getMetadata: storage.getMetadata,
    setMetadata: storage.setMetadata,
  };
}