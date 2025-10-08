// ABOUTME: Context hook for accessing conversation handlers from the layout
// ABOUTME: Provides startNewConversation and loadConversation methods to child components

"use client";

import { createContext, useContext } from "react";

// Context for conversation handlers
export const ConversationHandlersContext = createContext<{
  setHandlers: (handlers: {
    startNewConversation: () => string;
    loadConversation: (id: string) => Promise<void>;
  } | null) => void;
  handlers: {
    startNewConversation: () => string;
    loadConversation: (id: string) => Promise<void>;
  } | null;
}>({
  setHandlers: () => {},
  handlers: null,
});

export const useConversationHandlers = () => useContext(ConversationHandlersContext);
