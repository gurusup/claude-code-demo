// ABOUTME: React Query mutation hooks for modifying conversation data
// ABOUTME: Provides optimistic updates and cache invalidation for conversation operations

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConversationService } from '../../data/services/conversation.service';
import { conversationKeys } from '../queries/useConversationQuery';
import { toast } from 'sonner';
import type { ConversationMetadata } from '../../data/schemas/conversation.schema';

/**
 * Hook to create a new conversation
 */
export function useCreateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (metadata?: Record<string, any>) => {
      return await ConversationService.createConversation(metadata);
    },
    onSuccess: (conversationId) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      });

      console.log('Conversation created successfully:', conversationId);
      toast.success('New conversation started');
    },
    onError: (error) => {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to start new conversation');
    },
  });
}

/**
 * Hook to delete a conversation with optimistic list updates
 */
export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await ConversationService.deleteConversation(conversationId);
    },
    onMutate: async (conversationId) => {
      // Cancel outgoing queries for detail and lists
      await queryClient.cancelQueries({
        queryKey: conversationKeys.detail(conversationId),
      });
      await queryClient.cancelQueries({
        queryKey: conversationKeys.lists(),
      });

      // Snapshot previous state for rollback
      const previousLists = queryClient.getQueriesData({
        queryKey: conversationKeys.lists(),
      });

      // Optimistically remove from all list caches
      queryClient.setQueriesData(
        { queryKey: conversationKeys.lists() },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter((conv: any) => conv.id !== conversationId);
        }
      );

      // Optimistically remove detail cache
      queryClient.removeQueries({
        queryKey: conversationKeys.detail(conversationId),
      });

      return { conversationId, previousLists };
    },
    onSuccess: (_, conversationId) => {
      // Invalidate conversations list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      });

      console.log('Conversation deleted successfully:', conversationId);
      toast.success('Conversation deleted');
    },
    onError: (error, conversationId, context) => {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');

      // Rollback optimistic updates
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Refetch to restore correct state
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(conversationId),
      });
    },
  });
}

/**
 * Hook to update conversation metadata
 */
export function useUpdateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      metadata
    }: {
      conversationId: string;
      metadata: ConversationMetadata;
    }) => {
      return await ConversationService.updateConversationMetadata(conversationId, metadata);
    },
    onMutate: async ({ conversationId, metadata }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: conversationKeys.detail(conversationId)
      });

      // Get previous data
      const previousConversation = queryClient.getQueryData(
        conversationKeys.detail(conversationId)
      );

      // Optimistically update
      queryClient.setQueryData(
        conversationKeys.detail(conversationId),
        (old: any) => ({
          ...old,
          metadata: { ...old?.metadata, ...metadata },
          updatedAt: new Date().toISOString(),
        })
      );

      return { previousConversation, conversationId };
    },
    onSuccess: (_, { conversationId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(conversationId)
      });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      });

      console.log('Conversation metadata updated successfully');
    },
    onError: (error, { conversationId }, context) => {
      console.error('Failed to update conversation metadata:', error);
      toast.error('Failed to update conversation');

      // Rollback optimistic update
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationKeys.detail(conversationId),
          context.previousConversation
        );
      }
    },
  });
}

/**
 * Hook to archive a conversation
 */
export function useArchiveConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return await ConversationService.archiveConversation(conversationId);
    },
    onSuccess: (_, conversationId) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(conversationId)
      });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      });

      console.log('Conversation archived successfully:', conversationId);
      toast.success('Conversation archived');
    },
    onError: (error) => {
      console.error('Failed to archive conversation:', error);
      toast.error('Failed to archive conversation');
    },
  });
}

/**
 * Combined hook for all conversation mutations
 * Provides a unified interface for conversation operations
 */
export function useConversationMutations() {
  const createMutation = useCreateConversationMutation();
  const deleteMutation = useDeleteConversationMutation();
  const updateMutation = useUpdateConversationMutation();
  const archiveMutation = useArchiveConversationMutation();

  return {
    create: createMutation.mutate,
    delete: deleteMutation.mutate,
    update: updateMutation.mutate,
    archive: archiveMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdating: updateMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}