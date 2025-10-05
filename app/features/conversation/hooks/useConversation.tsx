// ABOUTME: Main business hook for conversation management
// ABOUTME: Orchestrates chat functionality by wrapping Vercel AI SDK with business logic

import { useChat } from 'ai/react';
import { toast } from 'sonner';
import { useConversationStorage } from './useConversationStorage';
import { useCallback, useEffect } from 'react';
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
    initialMessages,
    api: '/api/conversations',
    maxSteps,
    body: {
      conversationId: storage.conversationId,
    },
    onError: handleError,
    onFinish: (message) => {
      console.log('Message completed:', message);
      // Update conversation metadata
      storage.setMetadata({
        lastMessageAt: new Date().toISOString(),
        messageCount: messages.length + 1,
      });
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

    // Storage operations
    getMetadata: storage.getMetadata,
    setMetadata: storage.setMetadata,
  };
}