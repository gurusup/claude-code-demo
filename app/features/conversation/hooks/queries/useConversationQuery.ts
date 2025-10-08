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
 * Hook to fetch full conversation with messages
 */
export function useConversationMessagesQuery(
  conversationId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: async () => {
      const conversation = await ConversationService.getConversationById(conversationId);
      // Validate messages with schema
      const messages = MessagesSchema.parse(conversation.messages);
      return {
        ...conversation,
        messages,
      };
    },
    enabled: (options?.enabled ?? true) && !!conversationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    refetchOnMount: false, // Don't refetch on mount for messages
  });
}

/**
 * Hook to fetch conversation history/messages (legacy)
 * @deprecated Use useConversationMessagesQuery instead
 */
export function useConversationHistoryQuery(conversationId: string, enabled = true) {
  const query = useConversationMessagesQuery(conversationId, { enabled });
  return {
    ...query,
    data: query.data?.messages,
  };
}

/**
 * Hook to fetch list of conversations with optional filtering
 */
export function useConversationsListQuery(options?: {
  status?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const { status, limit = 100, offset = 0, enabled = true } = options || {};

  return useQuery({
    queryKey: conversationKeys.list({ status, limit, offset }),
    queryFn: async () => {
      const conversations = await ConversationService.listConversations({
        status,
        limit,
        offset,
      });
      // Validate with schema
      return ConversationListSchema.parse(conversations);
    },
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnMount: true, // Always refetch list on mount
  });
}

/**
 * Hook to prefetch conversation data
 * Useful for hover-triggered preloading (debounced 300ms)
 */
export function usePrefetchConversation() {
  const queryClient = useQueryClient();

  const prefetchConversation = useCallback(
    async (conversationId: string) => {
      await queryClient.prefetchQuery({
        queryKey: conversationKeys.messages(conversationId),
        queryFn: async () => {
          const conversation = await ConversationService.getConversationById(conversationId);
          const messages = MessagesSchema.parse(conversation.messages);
          return {
            ...conversation,
            messages,
          };
        },
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient]
  );

  return { prefetchConversation };
}

