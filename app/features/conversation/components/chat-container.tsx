// ABOUTME: Smart container component that orchestrates conversation logic
// ABOUTME: Connects business hooks to presentation components

"use client";

import { useConversation } from '../hooks/useConversation';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { Chat } from './chat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Create a stable QueryClient instance
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Container component that manages chat state and business logic
 * This is the smart component that uses hooks and passes props to the presentation component
 */
export function ChatContainer() {
  // Create QueryClient instance
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ChatContainerInner />
    </QueryClientProvider>
  );
}

/**
 * Inner container to use hooks within QueryClientProvider context
 */
function ChatContainerInner() {
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