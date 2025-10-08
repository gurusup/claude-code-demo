// ABOUTME: Smart container component that orchestrates conversation logic
// ABOUTME: Connects business hooks to presentation components

"use client";

import { useEffect, useRef } from 'react';
import { useConversation } from '../hooks/useConversation';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { Chat } from './chat';
import { useConversationHandlers } from '../hooks/useConversationHandlers';

/**
 * Container component that manages chat state and business logic
 * This is the smart component that uses hooks and passes props to the presentation component
 */
export function ChatContainer() {
  const { setHandlers } = useConversationHandlers();
  const handlersSetRef = useRef(false);

  // Use the main conversation hook
  const conversation = useConversation({
    onConversationStart: (id) => {
      console.log('Conversation started:', id);
    },
    onNewConversation: (id) => {
      console.log('New conversation created:', id);
    },
    onError: (error) => {
      console.error('Conversation error:', error);
    },
  });

  // Expose conversation control functions to layout via context (only once)
  useEffect(() => {
    if (!handlersSetRef.current) {
      setHandlers({
        startNewConversation: conversation.startNewConversation,
        loadConversation: conversation.loadConversation,
      });
      handlersSetRef.current = true;
    }
  }, [setHandlers, conversation.startNewConversation, conversation.loadConversation]);

  // Scroll management
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  // Props for the presentation component - using the actual functions from the hook
  const chatProps = {
    // Conversation state
    conversationId: conversation.conversationId,
    messages: conversation.messages,
    input: conversation.input,
    isLoading: conversation.isLoading,
    isThinking: conversation.isThinking,
    isEmpty: conversation.isEmpty,

    // Actions - pass the actual functions from useChat hook
    setInput: conversation.setInput,
    handleSubmit: conversation.handleSubmit,
    stop: conversation.stop,
    onNewConversation: conversation.startNewConversation,
    setMessages: conversation.setMessages,
    append: conversation.append,

    // Refs for scrolling
    messagesContainerRef,
    messagesEndRef,
  };

  return <Chat {...chatProps} />;
}