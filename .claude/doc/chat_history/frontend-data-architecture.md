# Frontend Data Layer Architecture - Chat History Management

**Feature**: Conversation History Management
**Author**: Frontend Developer Agent
**Date**: 2025-10-08
**Session**: `context_session_chat_history`

---

## Executive Summary

This document provides comprehensive architectural guidance for implementing the frontend data layer to manage conversation history. The architecture follows established patterns in the codebase using React Query, Zod schemas, service layers, and custom hooks composition.

**Key Requirements:**
- Fetch and display conversation list (recent 50-100)
- Load specific conversations by ID
- Delete conversations with optimistic updates
- Switch between conversations seamlessly
- Proper cache management and error handling

---

## 1. React Query Integration

### 1.1 Query Keys Structure

The project already has an excellent query key factory pattern in `useConversationQuery.ts`. **Extend this pattern** rather than creating a new one:

```typescript
// app/features/conversation/hooks/queries/useConversationQuery.ts
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (id: string) => [...conversationKeys.detail(id), 'messages'] as const,
};
```

**Why this structure works:**
- Hierarchical keys enable precise cache invalidation
- `conversationKeys.all` invalidates everything
- `conversationKeys.lists()` invalidates only list queries
- `conversationKeys.detail(id)` invalidates a specific conversation
- Filters in `list(filters)` enable separate caches for "active" vs "archived"

**Filter Strategy:**
```typescript
// For active conversations
conversationKeys.list({ status: 'active' })

// For archived conversations
conversationKeys.list({ status: 'archived' })

// All conversations (no filter)
conversationKeys.list()
```

### 1.2 Stale Time and Cache Invalidation Strategy

Based on the existing patterns in `useConversationQuery.ts` and user behavior analysis:

**Conversation List Query:**
```typescript
staleTime: 1000 * 60 * 2,  // 2 minutes (already implemented)
gcTime: 1000 * 60 * 10,     // 10 minutes (already implemented)
refetchOnMount: true,        // Always get fresh data when sidebar opens
refetchOnWindowFocus: false, // Don't refetch on tab switch (annoying)
```

**Rationale:**
- 2-minute stale time balances freshness vs unnecessary requests
- Users don't switch conversations every second
- Refetch on mount ensures sidebar shows current state
- Window focus refetch disabled to avoid disrupting active chat

**Individual Conversation Messages Query:**
```typescript
staleTime: 1000 * 60 * 5,  // 5 minutes (already implemented)
gcTime: 1000 * 60 * 30,    // 30 minutes (already implemented)
refetchOnMount: false,      // Don't refetch if already cached
refetchOnWindowFocus: false,
```

**Rationale:**
- Messages don't change once loaded (append-only in this architecture)
- Higher stale time reduces redundant fetches
- Longer garbage collection keeps recently viewed conversations accessible

**Cache Invalidation Events:**
```typescript
// Invalidate list when:
1. New conversation created → invalidateQueries(conversationKeys.lists())
2. Conversation deleted → invalidateQueries(conversationKeys.lists())
3. Message sent → invalidateQueries(conversationKeys.lists()) // Updates "lastMessageAt"
4. Conversation archived → invalidateQueries(conversationKeys.lists())

// Invalidate detail when:
1. Messages added → invalidateQueries(conversationKeys.messages(id))
2. Conversation deleted → removeQueries(conversationKeys.detail(id))
3. Metadata updated → invalidateQueries(conversationKeys.detail(id))
```

### 1.3 Prefetching Conversations on Hover

Implement intelligent prefetching to improve perceived performance:

```typescript
// app/features/conversation/hooks/queries/useConversationQuery.ts
export function usePrefetchConversation(conversationId: string) {
  const queryClient = useQueryClient();

  const prefetchConversation = useCallback(async () => {
    // Check if already in cache
    const existingData = queryClient.getQueryData(
      conversationKeys.messages(conversationId)
    );

    if (existingData) {
      return; // Already cached, skip prefetch
    }

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
```

**Usage in Conversation List Item:**
```typescript
// Trigger on mouseEnter, debounced by 300ms
<ConversationListItem
  onMouseEnter={() => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      prefetchConversation();
    }, 300);
  }}
  onMouseLeave={() => {
    clearTimeout(hoverTimeout);
  }}
/>
```

**Prefetch Strategy:**
- Only prefetch if not already in cache (avoid redundant requests)
- 300ms debounce prevents accidental hovers from triggering fetches
- Prefetched data shares same cache as normal queries
- Reduces perceived load time when user clicks conversation

### 1.4 Optimistic Updates for Delete Operation

The existing `useDeleteConversationMutation` already has excellent optimistic update logic. **Keep this pattern:**

```typescript
// Current implementation (already correct):
onMutate: async (conversationId) => {
  // 1. Cancel outgoing queries to prevent race conditions
  await queryClient.cancelQueries({
    queryKey: conversationKeys.detail(conversationId)
  });

  // 2. Optimistically remove from cache
  queryClient.removeQueries({
    queryKey: conversationKeys.detail(conversationId)
  });

  return { conversationId };
},
onSuccess: (_, conversationId) => {
  // 3. Invalidate list to remove from UI
  queryClient.invalidateQueries({
    queryKey: conversationKeys.lists()
  });
},
onError: (error, conversationId) => {
  // 4. Refetch to restore state on error
  queryClient.invalidateQueries({
    queryKey: conversationKeys.detail(conversationId)
  });
}
```

**Enhancement for List Optimistic Update:**
```typescript
// Add this to onMutate for instant UI feedback:
onMutate: async (conversationId) => {
  await queryClient.cancelQueries({
    queryKey: conversationKeys.lists()
  });

  // Get previous list data for rollback
  const previousLists = queryClient.getQueryData(conversationKeys.lists());

  // Optimistically remove from list
  queryClient.setQueryData(
    conversationKeys.lists(),
    (old: ConversationList | undefined) => {
      return old?.filter(conv => conv.id !== conversationId) ?? [];
    }
  );

  // Remove detail cache
  queryClient.removeQueries({
    queryKey: conversationKeys.detail(conversationId)
  });

  return { conversationId, previousLists };
},
onError: (error, conversationId, context) => {
  // Rollback optimistic update
  if (context?.previousLists) {
    queryClient.setQueryData(
      conversationKeys.lists(),
      context.previousLists
    );
  }
}
```

### 1.5 Error Handling and Retry Logic

Follow existing patterns with domain-specific enhancements:

```typescript
// Default retry configuration (already used):
retry: 2,  // Retry failed requests twice
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

// Custom retry logic for conversation list:
retry: (failureCount, error) => {
  // Don't retry on 404 (conversation not found)
  if (error?.response?.status === 404) return false;

  // Don't retry on 403 (forbidden - user doesn't have access)
  if (error?.response?.status === 403) return false;

  // Retry network errors and 5xx errors up to 2 times
  return failureCount < 2;
},

// Error handling in query:
onError: (error) => {
  console.error('Failed to fetch conversations:', error);

  if (error?.response?.status === 404) {
    toast.error('Conversations not found');
  } else if (error?.response?.status === 403) {
    toast.error('Access denied');
  } else if (error?.response?.status >= 500) {
    toast.error('Server error. Please try again later.');
  } else if (error?.message?.includes('Network')) {
    toast.error('Network error. Check your connection.');
  } else {
    toast.error('Failed to load conversations');
  }
}
```

---

## 2. Service Layer Design

### 2.1 conversation.service.ts Enhancement

The existing service has good foundations. **Enhance with:**

**Type Safety Improvements:**
```typescript
// app/features/conversation/data/services/conversation.service.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Message } from 'ai';
import type { ConversationListItem } from '../schemas/conversation.schema';

export class ConversationService {
  private static axiosInstance: AxiosInstance = axios.create({
    baseURL: '/api',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
  });

  /**
   * Fetch paginated list of conversations
   * @param options - Filtering and pagination options
   */
  static async listConversations(options?: {
    status?: 'active' | 'archived';
    limit?: number;
    offset?: number;
  }): Promise<ConversationListItem[]> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await this.axiosInstance.get(
        `/conversations/list?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error('Failed to list conversations:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch conversation messages by ID
   */
  static async getConversationHistory(conversationId: string): Promise<Message[]> {
    try {
      const response = await this.axiosInstance.get(
        `/conversations/${conversationId}/messages`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversation history:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete conversation by ID (hard delete)
   */
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      await this.axiosInstance.delete(`/conversations/${conversationId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Centralized error handling
   */
  private static handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;

      if (axiosError.response) {
        // Server responded with error
        const message = axiosError.response.data?.error
          || axiosError.response.data?.message
          || `Request failed with status ${axiosError.response.status}`;

        const enhancedError = new Error(message);
        (enhancedError as any).response = axiosError.response;
        return enhancedError;
      } else if (axiosError.request) {
        // Request made but no response
        return new Error('Network error: No response from server');
      }
    }

    // Unknown error
    return error instanceof Error ? error : new Error('Unknown error occurred');
  }
}
```

### 2.2 Error Handling Patterns

**Axios vs Fetch:**
- **Keep Axios** (already installed, better TypeScript support)
- Axios advantages:
  - Automatic JSON parsing
  - Request/response interceptors
  - Better error handling with `AxiosError`
  - Request cancellation built-in
  - Timeout support
  - Consistent API across browsers

**Error Classification:**
```typescript
export class ConversationServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ConversationServiceError';
  }

  isNetworkError(): boolean {
    return !this.statusCode;
  }

  isClientError(): boolean {
    return this.statusCode ? this.statusCode >= 400 && this.statusCode < 500 : false;
  }

  isServerError(): boolean {
    return this.statusCode ? this.statusCode >= 500 : false;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}
```

### 2.3 Request Cancellation

React Query handles request cancellation automatically via `AbortSignal`. **No additional implementation needed** unless you need manual control:

```typescript
// React Query provides AbortSignal automatically
static async listConversations(
  options?: ListOptions,
  signal?: AbortSignal
): Promise<ConversationListItem[]> {
  const response = await this.axiosInstance.get('/conversations/list', {
    params: options,
    signal, // Axios supports AbortSignal
  });
  return response.data;
}

// React Query automatically passes signal:
useQuery({
  queryKey: conversationKeys.lists(),
  queryFn: ({ signal }) => ConversationService.listConversations(undefined, signal),
});
```

---

## 3. Hook Architecture

### 3.1 Query Hooks

**Pattern: One hook per query operation**

The existing `useConversationQuery.ts` already implements this correctly. **Continue this pattern:**

```typescript
// app/features/conversation/hooks/queries/useConversationQuery.ts

/**
 * Hook to fetch filtered conversation list
 * @param status - Filter by status (active/archived)
 * @param enabled - Enable/disable query
 */
export function useConversationsListQuery(
  status?: 'active' | 'archived',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: conversationKeys.list({ status }),
    queryFn: async () => {
      const conversations = await ConversationService.listConversations({
        status,
        limit: 100, // As per Fran's requirement: 50-100 conversations
      });
      return ConversationListSchema.parse(conversations);
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 2,
  });
}

/**
 * Hook to fetch single conversation with messages
 * @param conversationId - ID of conversation to fetch
 * @param enabled - Enable/disable query
 */
export function useConversationMessagesQuery(
  conversationId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: async () => {
      const messages = await ConversationService.getConversationHistory(conversationId);
      return MessagesSchema.parse(messages);
    },
    enabled: (options?.enabled ?? true) && !!conversationId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });
}
```

### 3.2 Mutation Hooks

**Pattern: Mutation hooks return standardized response**

Existing `useConversationMutation.ts` follows correct patterns. **Enhance delete mutation** with list optimistic update:

```typescript
// app/features/conversation/hooks/mutations/useConversationMutation.ts

/**
 * Hook to delete a conversation with optimistic UI updates
 */
export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return await ConversationService.deleteConversation(conversationId);
    },

    onMutate: async (conversationId) => {
      // Cancel all related queries
      await queryClient.cancelQueries({
        queryKey: conversationKeys.lists()
      });
      await queryClient.cancelQueries({
        queryKey: conversationKeys.detail(conversationId)
      });

      // Snapshot previous state for rollback
      const previousLists = queryClient.getQueriesData({
        queryKey: conversationKeys.lists()
      });

      // Optimistically remove from all list variants
      queryClient.setQueriesData(
        { queryKey: conversationKeys.lists() },
        (old: ConversationListItem[] | undefined) => {
          return old?.filter(conv => conv.id !== conversationId) ?? [];
        }
      );

      // Remove detail cache
      queryClient.removeQueries({
        queryKey: conversationKeys.detail(conversationId)
      });

      return { conversationId, previousLists };
    },

    onSuccess: (_, conversationId) => {
      // Invalidate to sync with server
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      });

      console.log('Conversation deleted:', conversationId);
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

      // Refetch to ensure correct state
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      });
    },
  });
}
```

**Mutation Hook Response Pattern:**
```typescript
// All mutation hooks should expose:
{
  mutate: (params) => void,        // Trigger mutation
  mutateAsync: (params) => Promise, // Async trigger
  isPending: boolean,               // Loading state
  isSuccess: boolean,               // Success state
  isError: boolean,                 // Error state
  error: Error | null,              // Error object
  data: Result | undefined,         // Result data
  reset: () => void,                // Reset mutation state
}
```

### 3.3 Custom Business Hook: useSwitchConversation

**Create a new business hook** to orchestrate conversation switching:

```typescript
// app/features/conversation/hooks/useSwitchConversation.ts
// ABOUTME: Business hook for switching between conversations
// ABOUTME: Orchestrates loading conversation messages and updating active state

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversationMessagesQuery, conversationKeys } from './queries/useConversationQuery';
import { useConversationStorage } from './useConversationStorage';
import { toast } from 'sonner';

export interface UseSwitchConversationOptions {
  /**
   * Callback when conversation switch starts
   */
  onSwitchStart?: (conversationId: string) => void;

  /**
   * Callback when conversation switch completes
   */
  onSwitchComplete?: (conversationId: string) => void;

  /**
   * Callback when conversation switch fails
   */
  onSwitchError?: (error: Error) => void;
}

/**
 * Hook for switching between conversations
 * Handles loading messages, updating storage, and state management
 */
export function useSwitchConversation(options: UseSwitchConversationOptions = {}) {
  const { onSwitchStart, onSwitchComplete, onSwitchError } = options;
  const storage = useConversationStorage();
  const queryClient = useQueryClient();

  /**
   * Switch to a different conversation
   * @param conversationId - ID of conversation to switch to
   */
  const switchConversation = useCallback(async (conversationId: string) => {
    // Don't switch if already on this conversation
    if (storage.conversationId === conversationId) {
      return;
    }

    try {
      // Notify switch start
      onSwitchStart?.(conversationId);

      // Prefetch conversation messages if not in cache
      const existingData = queryClient.getQueryData(
        conversationKeys.messages(conversationId)
      );

      if (!existingData) {
        await queryClient.prefetchQuery({
          queryKey: conversationKeys.messages(conversationId),
          queryFn: async () => {
            const messages = await ConversationService.getConversationHistory(conversationId);
            return MessagesSchema.parse(messages);
          },
        });
      }

      // Update storage to new conversation ID
      storage.loadConversation(conversationId);

      // Notify switch complete
      onSwitchComplete?.(conversationId);

      console.log('Switched to conversation:', conversationId);
    } catch (error) {
      console.error('Failed to switch conversation:', error);

      const errorObj = error instanceof Error ? error : new Error('Failed to switch conversation');
      onSwitchError?.(errorObj);

      toast.error('Failed to load conversation');
    }
  }, [storage, queryClient, onSwitchStart, onSwitchComplete, onSwitchError]);

  return {
    switchConversation,
    currentConversationId: storage.conversationId,
  };
}
```

---

## 4. State Management

### 4.1 Active Conversation Tracking

**Recommendation: Use existing `useConversationStorage` hook**

The current implementation already manages active conversation ID via sessionStorage. **This is the right approach** because:

✅ **Pros of current approach:**
- Simple and focused (single responsibility)
- Persists across page reloads within session
- No additional dependencies (no Zustand needed)
- Already integrated with `useConversation` hook
- Tab-scoped (each tab has independent conversation)

❌ **Why NOT to use Zustand/Context for this:**
- Overkill for single string value
- Adds unnecessary complexity
- Context causes re-renders on every change
- Zustand adds bundle size
- sessionStorage already provides persistence

**Enhancement: Add active conversation validation**

```typescript
// app/features/conversation/hooks/useConversationStorage.ts

import { useState, useEffect, useCallback } from 'react';
import { ConversationStorageService } from '../data/services/storage.service';
import { useQueryClient } from '@tanstack/react-query';
import { conversationKeys } from './queries/useConversationQuery';

export function useConversationStorage() {
  const [conversationId, setConversationId] = useState<string>(() => {
    return ConversationStorageService.getOrCreateConversationId();
  });

  const queryClient = useQueryClient();

  /**
   * Load a specific conversation with validation
   */
  const loadConversation = useCallback(async (id: string) => {
    // Validate conversation exists in cache or fetch it
    const existsInCache = queryClient.getQueryData(
      conversationKeys.messages(id)
    );

    if (!existsInCache) {
      // Prefetch to validate it exists
      try {
        await queryClient.prefetchQuery({
          queryKey: conversationKeys.messages(id),
          queryFn: async () => {
            const messages = await ConversationService.getConversationHistory(id);
            return MessagesSchema.parse(messages);
          },
        });
      } catch (error) {
        console.error('Failed to load conversation:', error);
        throw new Error('Conversation not found');
      }
    }

    // Update storage
    ConversationStorageService.setConversationId(id);
    setConversationId(id);
    console.log('Loaded conversation:', id);
  }, [queryClient]);

  /**
   * Check if conversation exists before loading
   */
  const conversationExists = useCallback((id: string) => {
    const existsInCache = queryClient.getQueryData(
      conversationKeys.messages(id)
    );
    return !!existsInCache;
  }, [queryClient]);

  return {
    conversationId,
    startNewConversation,
    clearConversation,
    loadConversation,
    conversationExists,
    hasStoredConversation,
    getMetadata,
    setMetadata,
  };
}
```

### 4.2 Syncing Active Conversation with URL Params

**Recommendation: DON'T sync with URL params** (at least initially)

**Rationale:**
- Current architecture uses sessionStorage (tab-scoped)
- URL params make conversations shareable (adds complexity)
- Would require authentication/authorization checks
- Browser history becomes polluted with conversation switches
- "New conversation" button semantics become unclear

**Alternative: If you need URL routing later:**
```typescript
// Future enhancement: Optional URL routing
// app/chat/[conversationId]/page.tsx

export default function ChatPage({ params }: { params: { conversationId: string } }) {
  const { loadConversation } = useConversationStorage();

  useEffect(() => {
    if (params.conversationId) {
      loadConversation(params.conversationId);
    }
  }, [params.conversationId, loadConversation]);

  return <ChatContainer />;
}

// Then use Next.js navigation:
import { useRouter } from 'next/navigation';

const switchConversation = (id: string) => {
  router.push(`/chat/${id}`);
};
```

**For now: Keep it simple with sessionStorage only.**

### 4.3 localStorage vs sessionStorage Sync

**Current approach: sessionStorage only** ✅

**Should you add localStorage sync?**

**No**, because:
- sessionStorage is intentional (fresh conversation per tab)
- localStorage would leak conversations across tabs (confusing UX)
- MongoDB is the source of truth for persistence
- Session-scoped conversations prevent accidental cross-contamination

**When to use localStorage:**
- User preferences (theme, sidebar state)
- Draft messages (auto-save)
- UI state (sidebar collapsed/expanded)

### 4.4 Message State When Switching Conversations

**Critical: Clear messages before loading new conversation**

Enhance `useConversation` hook to support loading conversations:

```typescript
// app/features/conversation/hooks/useConversation.tsx

export function useConversation(options: UseConversationOptions = {}) {
  // ... existing code ...

  /**
   * Load an existing conversation by ID
   * Clears current messages and loads history
   */
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      // 1. Clear current messages immediately (optimistic)
      setMessages([]);
      setInput('');

      // 2. Update storage to new conversation
      storage.loadConversation(conversationId);

      // 3. Fetch messages for new conversation
      const messages = await ConversationService.getConversationHistory(conversationId);

      // 4. Set messages from history
      setMessages(messages);

      console.log('Loaded conversation:', conversationId, 'with', messages.length, 'messages');

      return messages;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('Failed to load conversation');

      // On error, keep messages cleared
      setMessages([]);
      throw error;
    }
  }, [storage, setMessages, setInput]);

  return {
    // ... existing returns ...
    loadConversation, // NEW: Add this to returned interface
  };
}
```

**Usage in Sidebar:**
```typescript
// Sidebar conversation item click handler
const { loadConversation } = useConversation();

const handleConversationClick = async (conversationId: string) => {
  setIsLoading(true);
  try {
    await loadConversation(conversationId);
    // Optionally close sidebar on mobile
    if (isMobile) {
      closeSidebar();
    }
  } catch (error) {
    // Error already handled by loadConversation
  } finally {
    setIsLoading(false);
  }
};
```

---

## 5. useConversation Hook Enhancement

### 5.1 Adding loadConversation Function

**Implementation already outlined in Section 4.4**

**Enhanced type safety:**
```typescript
export interface UseConversationReturn {
  // Existing properties...
  conversationId: string;
  messages: Message[];

  // NEW: Loading state for conversation switching
  isLoadingConversation: boolean;

  // NEW: Load existing conversation
  loadConversation: (conversationId: string) => Promise<Message[]>;

  // Existing methods...
  startNewConversation: () => string;
  clearMessages: () => void;
}
```

### 5.2 Handling Loading States During Switch

**Add loading state tracking:**
```typescript
export function useConversation(options: UseConversationOptions = {}) {
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const loadConversation = useCallback(async (conversationId: string) => {
    setIsLoadingConversation(true);
    try {
      setMessages([]);
      setInput('');
      storage.loadConversation(conversationId);

      const messages = await ConversationService.getConversationHistory(conversationId);
      setMessages(messages);

      return messages;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('Failed to load conversation');
      setMessages([]);
      throw error;
    } finally {
      setIsLoadingConversation(false);
    }
  }, [storage, setMessages, setInput]);

  return {
    // ... existing ...
    isLoadingConversation,
    loadConversation,
  };
}
```

**UI feedback during loading:**
```typescript
// In ChatContainer component
const { isLoadingConversation, messages } = useConversation();

if (isLoadingConversation) {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner />
      <p className="ml-2 text-muted-foreground">Loading conversation...</p>
    </div>
  );
}
```

### 5.3 Error States When Conversation Not Found

**Comprehensive error handling:**
```typescript
export function useConversation(options: UseConversationOptions = {}) {
  const [loadError, setLoadError] = useState<Error | null>(null);

  const loadConversation = useCallback(async (conversationId: string) => {
    setIsLoadingConversation(true);
    setLoadError(null); // Clear previous errors

    try {
      setMessages([]);
      setInput('');
      storage.loadConversation(conversationId);

      const messages = await ConversationService.getConversationHistory(conversationId);
      setMessages(messages);

      return messages;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Failed to load conversation');
      setLoadError(errorObj);

      console.error('Failed to load conversation:', error);

      // User-friendly error messages
      if (errorObj.message.includes('404') || errorObj.message.includes('not found')) {
        toast.error('Conversation not found');
      } else if (errorObj.message.includes('Network')) {
        toast.error('Network error. Check your connection.');
      } else {
        toast.error('Failed to load conversation');
      }

      setMessages([]);
      throw errorObj;
    } finally {
      setIsLoadingConversation(false);
    }
  }, [storage, setMessages, setInput]);

  return {
    // ... existing ...
    loadError,
    clearLoadError: () => setLoadError(null),
  };
}
```

**Error UI:**
```typescript
// In ChatContainer component
const { loadError, clearLoadError } = useConversation();

if (loadError) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <p className="text-destructive mb-4">Failed to load conversation</p>
      <Button onClick={clearLoadError}>Back to Chat</Button>
    </div>
  );
}
```

---

## 6. Performance Optimization

### 6.1 Pagination vs Infinite Scroll

**Recommendation: Start with simple pagination (limit 100)**

**Rationale:**
- Fran specified "50-100 conversations" limit
- 100 conversations render instantly (no performance issues)
- Simpler implementation and maintenance
- Better UX for power users (can scan entire list)
- Avoid complexity of infinite scroll for MVP

**Future: If conversation count exceeds 200, implement pagination**

```typescript
// Future implementation pattern:
export function useConversationsListQuery(options?: {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'archived';
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;

  return useQuery({
    queryKey: conversationKeys.list({
      status: options?.status,
      page,
      pageSize
    }),
    queryFn: async () => {
      const conversations = await ConversationService.listConversations({
        status: options?.status,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return ConversationListSchema.parse(conversations);
    },
    keepPreviousData: true, // Keep old data while fetching new page
  });
}
```

**Don't implement infinite scroll because:**
- Adds complexity (intersection observer, scroll position management)
- Harder to search/filter
- Pagination is simpler and more predictable
- 100 items is not a performance bottleneck

### 6.2 Debouncing Filter Changes

**When to debounce:**
- Search input (user typing)
- Slider/range filters (rapid changes)

**When NOT to debounce:**
- Radio buttons (active/archived status)
- Dropdown selections
- Checkboxes

**Implementation for search (future enhancement):**
```typescript
import { useDebouncedValue } from 'usehooks-ts';

export function ConversationSidebar() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300); // 300ms delay

  const { data: conversations } = useConversationsListQuery();

  const filteredConversations = useMemo(() => {
    if (!debouncedSearch) return conversations;
    return conversations?.filter(conv =>
      conv.metadata.title?.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [conversations, debouncedSearch]);

  return (
    <Input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search conversations..."
    />
  );
}
```

**Note: Fran only wants status filter (active/archived), so debouncing isn't needed for MVP.**

### 6.3 Memoization Strategies

**What to memoize:**

```typescript
// 1. Expensive computations
const sortedConversations = useMemo(() => {
  if (!conversations) return [];
  return [...conversations].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}, [conversations]);

// 2. Callback functions passed to children
const handleConversationClick = useCallback((id: string) => {
  loadConversation(id);
}, [loadConversation]);

// 3. Derived state
const hasConversations = useMemo(() =>
  conversations && conversations.length > 0
, [conversations]);

// 4. Filter functions
const activeConversations = useMemo(() =>
  conversations?.filter(c => c.status === 'active') ?? []
, [conversations]);
```

**What NOT to memoize:**
```typescript
// ❌ Don't memoize primitives
const conversationCount = useMemo(() => conversations?.length ?? 0, [conversations]);
// ✅ Just use directly
const conversationCount = conversations?.length ?? 0;

// ❌ Don't memoize simple object access
const firstConversation = useMemo(() => conversations?.[0], [conversations]);
// ✅ Just use directly
const firstConversation = conversations?.[0];
```

### 6.4 Suspense Boundaries

**Recommendation: DON'T use Suspense for this feature** (at least initially)

**Rationale:**
- Suspense with React Query requires experimental features
- Loading states with `isLoading` are clearer and more debuggable
- Suspense error boundaries add complexity
- Traditional loading patterns work perfectly fine

**If you want to use Suspense later:**
```typescript
// Enable suspense mode in query
export function useConversationsListQuery() {
  return useSuspenseQuery({ // Notice: useSuspenseQuery
    queryKey: conversationKeys.lists(),
    queryFn: async () => {
      const conversations = await ConversationService.listConversations();
      return ConversationListSchema.parse(conversations);
    },
  });
}

// Wrap component with Suspense
<Suspense fallback={<ConversationListSkeleton />}>
  <ConversationList />
</Suspense>
```

**Stick with traditional loading for now:**
```typescript
const { data, isLoading, error } = useConversationsListQuery();

if (isLoading) return <ConversationListSkeleton />;
if (error) return <ErrorMessage />;
if (!data) return null;

return <ConversationList conversations={data} />;
```

---

## 7. Integration with Existing Architecture

### 7.1 File Structure

```
app/features/conversation/
├── components/
│   ├── chat-container.tsx              # Existing
│   ├── conversation-sidebar.tsx        # NEW: Main sidebar component
│   ├── conversation-list.tsx           # NEW: List of conversations
│   ├── conversation-list-item.tsx      # NEW: Individual item
│   ├── conversation-list-skeleton.tsx  # NEW: Loading skeleton
│   └── ...existing components
├── hooks/
│   ├── useConversation.tsx             # ENHANCE: Add loadConversation
│   ├── useConversationStorage.ts       # ENHANCE: Add validation
│   ├── useSwitchConversation.ts        # NEW: Switching orchestration
│   ├── queries/
│   │   └── useConversationQuery.ts     # ENHANCE: Add list query
│   └── mutations/
│       └── useConversationMutation.ts  # Already has delete mutation
├── data/
│   ├── services/
│   │   ├── conversation.service.ts     # ENHANCE: Add listConversations
│   │   └── storage.service.ts          # Keep as-is
│   └── schemas/
│       ├── conversation.schema.ts      # Already has ConversationListItem
│       └── message.schema.ts           # Keep as-is
```

### 7.2 Component Integration Pattern

**Sidebar should be added to layout:**

```typescript
// app/layout.tsx or app/page.tsx
import { ConversationSidebar } from '@/app/features/conversation/components/conversation-sidebar';
import { ChatContainer } from '@/app/features/conversation/components/chat-container';

export default function ChatPage() {
  return (
    <div className="flex h-screen">
      <ConversationSidebar />
      <main className="flex-1">
        <ChatContainer />
      </main>
    </div>
  );
}
```

**Sidebar component structure:**
```typescript
// app/features/conversation/components/conversation-sidebar.tsx
export function ConversationSidebar() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const { data: conversations, isLoading, error } = useConversationsListQuery(statusFilter);
  const { switchConversation } = useSwitchConversation();

  return (
    <aside className="w-80 border-r flex flex-col">
      {/* Header with status filter */}
      <ConversationSidebarHeader
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* Conversation list */}
      {isLoading && <ConversationListSkeleton />}
      {error && <ErrorMessage error={error} />}
      {conversations && (
        <ConversationList
          conversations={conversations}
          onConversationClick={switchConversation}
        />
      )}
    </aside>
  );
}
```

### 7.3 Backend API Expectations

**Expected endpoints (need to be implemented by backend team):**

1. **GET /api/conversations/list**
   - Query params: `?status=active&limit=100&offset=0`
   - Response:
     ```typescript
     [
       {
         id: string;
         title?: string;
         status: 'active' | 'archived';
         createdAt: string; // ISO 8601
         updatedAt: string; // ISO 8601
         messageCount: number;
         lastMessage?: string; // Preview of last message
       }
     ]
     ```

2. **GET /api/conversations/:id/messages**
   - Already implemented (used by `getConversationHistory`)
   - Response: `Message[]` (Vercel AI SDK format)

3. **DELETE /api/conversations/:id**
   - Already planned in backend architecture
   - Response: `{ success: boolean }` or 204 No Content

**Schema alignment:**
- Frontend `ConversationListItemSchema` must match backend response
- Backend should transform MongoDB documents to match schema
- Use Zod on backend too for consistency (if using TypeScript)

---

## 8. Testing Considerations

### 8.1 Query Hook Tests

```typescript
// app/features/conversation/hooks/queries/__tests__/useConversationQuery.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationsListQuery } from '../useConversationQuery';
import { ConversationService } from '../../../data/services/conversation.service';

jest.mock('../../../data/services/conversation.service');

describe('useConversationsListQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('should fetch conversations successfully', async () => {
    const mockConversations = [
      { id: '1', title: 'Test', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    ];

    (ConversationService.listConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { result } = renderHook(() => useConversationsListQuery(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockConversations);
  });

  it('should handle errors gracefully', async () => {
    (ConversationService.listConversations as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => useConversationsListQuery(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
```

### 8.2 Mutation Hook Tests

```typescript
// Test optimistic updates, rollbacks, cache invalidation
describe('useDeleteConversationMutation', () => {
  it('should optimistically remove conversation from cache', async () => {
    // Setup cache with conversations
    queryClient.setQueryData(conversationKeys.lists(), mockConversations);

    const { result } = renderHook(() => useDeleteConversationMutation(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    // Trigger mutation
    act(() => {
      result.current.mutate('conversation-1');
    });

    // Check optimistic update
    const cacheData = queryClient.getQueryData(conversationKeys.lists());
    expect(cacheData).not.toContainEqual(expect.objectContaining({ id: 'conversation-1' }));
  });

  it('should rollback on error', async () => {
    // Test error rollback logic
  });
});
```

### 8.3 Service Layer Tests

```typescript
// app/features/conversation/data/services/__tests__/conversation.service.test.ts

import { ConversationService } from '../conversation.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ConversationService', () => {
  describe('listConversations', () => {
    it('should fetch conversations with correct params', async () => {
      const mockResponse = { data: [] };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await ConversationService.listConversations({ status: 'active', limit: 100 });

      expect(result).toEqual([]);
      // Verify correct API call
    });
  });
});
```

---

## 9. Migration Path and Rollout Strategy

### 9.1 Phase 1: Data Layer (Week 1)

**Goals:**
- ✅ Backend implements `/api/conversations/list` endpoint
- ✅ Frontend creates schemas, services, query hooks
- ✅ Unit tests for service layer and query hooks

**Implementation order:**
1. Update `conversation.schema.ts` (if needed)
2. Enhance `conversation.service.ts` with `listConversations`
3. Add `useConversationsListQuery` to `useConversationQuery.ts`
4. Add tests
5. Verify with backend integration tests

**Acceptance criteria:**
- Query hook successfully fetches conversation list
- Schemas validate backend responses
- Error handling works for network/server errors

### 9.2 Phase 2: State Management (Week 1-2)

**Goals:**
- ✅ Enhance `useConversationStorage` with validation
- ✅ Add `loadConversation` to `useConversation` hook
- ✅ Create `useSwitchConversation` business hook
- ✅ Add tests

**Implementation order:**
1. Add `conversationExists` to `useConversationStorage`
2. Add `loadConversation` and loading states to `useConversation`
3. Create `useSwitchConversation` hook
4. Add integration tests
5. Test conversation switching flow end-to-end

**Acceptance criteria:**
- Can switch between conversations without errors
- Messages clear before loading new conversation
- Loading states display correctly
- Errors handled gracefully

### 9.3 Phase 3: Mutation Operations (Week 2)

**Goals:**
- ✅ Enhance delete mutation with list optimistic updates
- ✅ Test optimistic updates and rollbacks
- ✅ Verify cache invalidation

**Implementation order:**
1. Enhance `useDeleteConversationMutation` (already mostly done)
2. Add optimistic list updates
3. Test rollback scenarios
4. Integration test with backend

**Acceptance criteria:**
- Conversation deleted immediately in UI
- Rollback works if server returns error
- Deleted conversation removed from all cache variants

### 9.4 Phase 4: UI Integration (Week 2-3)

**Goals:**
- ✅ Build sidebar components
- ✅ Integrate with existing chat container
- ✅ Add loading skeletons
- ✅ Mobile responsive design

**Implementation order:**
1. Create `conversation-sidebar.tsx`
2. Create `conversation-list.tsx` and `conversation-list-item.tsx`
3. Add loading skeletons
4. Integrate into main layout
5. Add mobile hamburger menu
6. E2E tests

**Acceptance criteria:**
- Sidebar displays conversation list
- Click conversation → loads messages
- Delete conversation → removes from list
- Mobile: sidebar collapsible
- Loading states smooth

---

## 10. Important Notes and Gotchas

### 10.1 React Query v5 Breaking Changes

Your project uses `@tanstack/react-query` v5.90.2. **Key changes from v4:**

✅ **Already handled correctly in existing code:**
- `cacheTime` → `gcTime` (garbage collection time)
- `useQuery` returns `isPending` instead of `isLoading` for initial load
- `useMutation` has `isPending` instead of `isLoading`

⚠️ **Watch out for:**
- `onSuccess`, `onError`, `onSettled` in `useQuery` are deprecated
  - Move to `queryClient.setQueryData` in `onSuccess` callback of `useMutation`
  - Or use `useEffect` to react to query state changes

❌ **Don't use deprecated patterns:**
```typescript
// ❌ Deprecated in v5
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  onSuccess: (data) => {
    // This is deprecated!
  }
});

// ✅ Use this instead
const query = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
});

useEffect(() => {
  if (query.isSuccess) {
    // Handle success
  }
}, [query.isSuccess]);
```

### 10.2 Vercel AI SDK Integration

Your `useConversation` hook wraps Vercel AI SDK's `useChat`. **Critical considerations:**

⚠️ **Message state synchronization:**
- `useChat` manages its own messages state
- When you call `setMessages([])`, it clears Vercel AI SDK's internal state
- When loading conversation, must use `setMessages(loadedMessages)`
- Don't try to manually append to `messages` array (use SDK's `append` method for new messages)

⚠️ **Body parameter with conversationId:**
```typescript
useChat({
  body: {
    conversationId: storage.conversationId, // ✅ Correct: reactive to changes
  }
});
```
- This `body` object is sent with every message
- When `storage.conversationId` changes, new messages go to new conversation
- **But**: Old messages still display until `setMessages` is called
- **Solution**: Always clear messages when switching conversations

### 10.3 SessionStorage Lifecycle

**SessionStorage behavior:**
- ✅ Persists across page reloads (within same tab)
- ✅ Separate per tab (each tab has independent conversation)
- ❌ Cleared when tab closes
- ❌ Not shared across tabs

**Implications:**
- User opens new tab → new conversation starts
- User reloads page → same conversation continues
- User closes tab → conversation ID lost (but data in MongoDB remains)

**Edge case to handle:**
```typescript
// What if user loads a conversation, then sessionStorage has stale ID?
useEffect(() => {
  // Sync React Query cache with sessionStorage on mount
  const storedId = storage.conversationId;
  const messagesInCache = queryClient.getQueryData(
    conversationKeys.messages(storedId)
  );

  if (messagesInCache && messages.length === 0) {
    // SessionStorage has ID but UI is empty → load from cache
    setMessages(messagesInCache);
  }
}, []);
```

### 10.4 Zod Schema Version

Your project uses `zod` v4.1.11. **Key notes:**

✅ **V4 features available:**
- `.transform()` for data transformation
- `.superRefine()` for custom validation
- `.pipe()` for schema composition
- Branded types with `.brand()`

⚠️ **Common mistakes:**
```typescript
// ❌ Wrong: Optional with default
.optional().default('value') // Default never applies!

// ✅ Correct: Default handles undefined
.default('value') // Automatically optional
```

### 10.5 Axios Timeout and Cancellation

Your service layer uses Axios with 10s timeout:

```typescript
axios.create({
  timeout: 10000, // 10 seconds
});
```

**Implications:**
- Long-running queries fail after 10s
- Loading large conversations may timeout
- **Solution**: Increase timeout for specific calls:

```typescript
static async getConversationHistory(conversationId: string): Promise<Message[]> {
  const response = await this.axiosInstance.get(
    `/conversations/${conversationId}/messages`,
    { timeout: 30000 } // 30 seconds for large conversations
  );
  return response.data;
}
```

**Automatic cancellation:**
- React Query cancels requests when component unmounts
- Axios respects `AbortSignal` automatically
- No manual cleanup needed

### 10.6 Performance: 100 Conversations Rendering

**Expectation: 100 items should render instantly**

But if performance issues arise:

1. **Use virtualization (react-virtual or react-window):**
   ```typescript
   import { useVirtualizer } from '@tanstack/react-virtual';

   const virtualizer = useVirtualizer({
     count: conversations.length,
     getScrollElement: () => scrollRef.current,
     estimateSize: () => 60, // 60px per item
   });
   ```

2. **Memoize list items:**
   ```typescript
   const ConversationListItem = memo(({ conversation, onClick }) => {
     // Component implementation
   });
   ```

3. **Debounce scroll events:**
   - Only needed if you add infinite scroll
   - Not needed for simple list

**For 100 items: None of these optimizations should be necessary.**

### 10.7 MongoDB Date Serialization

**Backend consideration (inform backend team):**

MongoDB stores dates as `Date` objects. When serialized to JSON:
```json
{
  "createdAt": "2025-10-08T12:34:56.789Z"  // ✅ ISO 8601 string
}
```

**Zod schema expects:**
```typescript
z.string().datetime() // ISO 8601 string
```

**Backend must ensure:**
- Dates serialized as ISO 8601 strings, not MongoDB `ISODate` objects
- Timezone is UTC (Z suffix)
- Milliseconds included for precision

**Example backend transformation:**
```typescript
// Backend: Convert MongoDB document to API response
const conversationDto = {
  id: doc._id.toString(),
  createdAt: doc.createdAt.toISOString(), // ✅ Convert Date to string
  updatedAt: doc.updatedAt.toISOString(),
};
```

---

## 11. Summary and Key Decisions

### Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Use existing query key factory** | Already well-designed, hierarchical, supports filters |
| **Keep sessionStorage (no URL routing)** | Simpler UX, tab-scoped conversations, avoid auth complexity |
| **Don't use Zustand/Context for active conversation** | Overkill for single string value, sessionStorage sufficient |
| **Keep Axios over fetch** | Better TypeScript support, error handling, already installed |
| **Use simple pagination (limit 100)** | Meets requirements, simpler than infinite scroll |
| **Don't use Suspense** | Traditional loading states clearer, no experimental features |
| **Optimistic delete with rollback** | Better UX, instant feedback, graceful error handling |
| **Prefetch on hover (debounced 300ms)** | Improves perceived performance without over-fetching |

### Files to Create

```
app/features/conversation/
├── components/
│   ├── conversation-sidebar.tsx              # NEW
│   ├── conversation-list.tsx                 # NEW
│   ├── conversation-list-item.tsx            # NEW
│   ├── conversation-list-skeleton.tsx        # NEW
│   └── conversation-sidebar-header.tsx       # NEW
├── hooks/
│   └── useSwitchConversation.ts              # NEW
```

### Files to Enhance

```
app/features/conversation/
├── hooks/
│   ├── useConversation.tsx                   # Add: loadConversation
│   ├── useConversationStorage.ts             # Add: validation
│   ├── queries/useConversationQuery.ts       # Add: list query (if not exists)
│   └── mutations/useConversationMutation.ts  # Enhance: delete optimistic
├── data/
│   └── services/
│       └── conversation.service.ts           # Add: listConversations, error handling
```

### Backend Dependencies

Backend team must implement:
1. `GET /api/conversations/list?status=active&limit=100`
2. Response schema matching `ConversationListItemSchema`
3. Proper date serialization (ISO 8601)
4. Hard delete for `DELETE /api/conversations/:id`

### Testing Requirements

- Unit tests: Query hooks, mutation hooks, service layer
- Integration tests: Hook composition, cache invalidation
- E2E tests: Conversation switching flow, delete with rollback
- Edge cases: Empty lists, network errors, 404s

---

## 12. Next Steps for Implementation

1. **Review this document** with the team
2. **Confirm backend API contract** matches frontend expectations
3. **Start with Phase 1** (data layer) - can be done in parallel with backend
4. **Mock API responses** for frontend development if backend not ready
5. **Create Storybook stories** for UI components (optional but recommended)
6. **Write tests as you go** - don't defer to the end

---

## Appendix: Code Examples

### Complete useConversationsListQuery Hook

```typescript
// app/features/conversation/hooks/queries/useConversationQuery.ts

/**
 * Hook to fetch filtered conversation list
 */
export function useConversationsListQuery(
  options?: {
    status?: 'active' | 'archived';
    enabled?: boolean;
  }
) {
  const { status, enabled = true } = options ?? {};

  return useQuery({
    queryKey: conversationKeys.list({ status }),
    queryFn: async () => {
      const conversations = await ConversationService.listConversations({
        status,
        limit: 100, // As per requirements
      });
      return ConversationListSchema.parse(conversations);
    },
    enabled,
    staleTime: 1000 * 60 * 2,  // 2 minutes
    gcTime: 1000 * 60 * 10,    // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or 403
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    onError: (error: any) => {
      console.error('Failed to fetch conversations:', error);

      if (error?.response?.status === 404) {
        toast.error('Conversations not found');
      } else if (error?.response?.status === 403) {
        toast.error('Access denied');
      } else if (error?.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error('Failed to load conversations');
      }
    },
  });
}
```

### Complete Enhanced conversation.service.ts

```typescript
// app/features/conversation/data/services/conversation.service.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Message } from 'ai';
import type { ConversationListItem } from '../schemas/conversation.schema';

export class ConversationServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ConversationServiceError';
  }
}

export class ConversationService {
  private static axiosInstance: AxiosInstance = axios.create({
    baseURL: '/api',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  /**
   * Fetch paginated list of conversations
   */
  static async listConversations(options?: {
    status?: 'active' | 'archived';
    limit?: number;
    offset?: number;
  }): Promise<ConversationListItem[]> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const queryString = params.toString();
      const url = `/conversations/list${queryString ? `?${queryString}` : ''}`;

      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch conversation messages by ID
   */
  static async getConversationHistory(conversationId: string): Promise<Message[]> {
    try {
      const response = await this.axiosInstance.get(
        `/conversations/${conversationId}/messages`,
        { timeout: 30000 } // 30s for large conversations
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete conversation by ID
   */
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      await this.axiosInstance.delete(`/conversations/${conversationId}`);
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Centralized error handling
   */
  private static handleError(error: unknown): ConversationServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;

      if (axiosError.response) {
        const message =
          axiosError.response.data?.error ||
          axiosError.response.data?.message ||
          `Request failed with status ${axiosError.response.status}`;

        return new ConversationServiceError(
          message,
          axiosError.response.status,
          axiosError.code
        );
      } else if (axiosError.request) {
        return new ConversationServiceError(
          'Network error: No response from server',
          undefined,
          axiosError.code
        );
      }
    }

    return new ConversationServiceError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}
```

---

**End of Document**

This architectural guidance provides a comprehensive foundation for implementing the conversation history management frontend data layer. Follow the established patterns, refer to existing implementations, and maintain consistency with the project's architecture.

For questions or clarifications, consult with the backend team on API contracts and with the UI/UX team on component designs.
