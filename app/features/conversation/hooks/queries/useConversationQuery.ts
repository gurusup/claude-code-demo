// ABOUTME: React Query hooks for fetching conversation data
// ABOUTME: Provides data fetching with caching and background refetching

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ConversationService } from '../../data/services/conversation.service';
import { ConversationListSchema, ConversationSchema } from '../../data/schemas/conversation.schema';
import { MessagesSchema } from '../../data/schemas/message.schema';
import type { Message } from 'ai';

/**
 * Query key factory for conversation queries
 */
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (id: string) => [...conversationKeys.detail(id), 'messages'] as const,
};

/**
 * Hook to fetch conversation history/messages
 */
export function useConversationHistoryQuery(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: async () => {
      const messages = await ConversationService.getConversationHistory(conversationId);
      // Validate with schema
      return MessagesSchema.parse(messages);
    },
    enabled: enabled && !!conversationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    retry: 2,
  });
}

/**
 * Hook to fetch list of conversations
 */
export function useConversationsListQuery(enabled = true) {
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: async () => {
      const conversations = await ConversationService.listConversations();
      // Validate with schema
      return ConversationListSchema.parse(conversations);
    },
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
  });
}

/**
 * Hook to prefetch conversation data
 * Useful for preloading data before navigation
 */
export function usePrefetchConversation(conversationId: string) {
  const queryClient = useQueryClient();

  const prefetchConversation = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: conversationKeys.messages(conversationId),
      queryFn: async () => {
        const messages = await ConversationService.getConversationHistory(conversationId);
        return MessagesSchema.parse(messages);
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [conversationId, queryClient]);

  return { prefetchConversation };
}

