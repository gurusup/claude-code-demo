# Frontend Testing Strategy for Conversation History Feature

## Document Overview
This document provides comprehensive testing strategies and patterns for the conversation history frontend implementation. It covers React component testing, custom hooks, React Query integration, and MSW for API mocking.

**Target Audience**: Frontend developers implementing tests for the conversation history sidebar feature.

**Last Updated**: 2025-10-08

---

## Table of Contents
1. [Testing Philosophy & Principles](#testing-philosophy--principles)
2. [Test Environment Setup](#test-environment-setup)
3. [Component Testing Strategy](#component-testing-strategy)
4. [Hook Testing Strategy](#hook-testing-strategy)
5. [Integration Testing Strategy](#integration-testing-strategy)
6. [Mock Strategy & Patterns](#mock-strategy--patterns)
7. [E2E Testing with Playwright](#e2e-testing-with-playwright)
8. [Test Utilities & Helpers](#test-utilities--helpers)
9. [Coverage Requirements](#coverage-requirements)
10. [Common Pitfalls & Solutions](#common-pitfalls--solutions)

---

## Testing Philosophy & Principles

### Core Testing Approach
Following the **Testing Trophy** methodology:
- **Unit Tests (20%)**: Pure functions, utilities, value objects
- **Integration Tests (60%)**: Component + hooks + React Query interactions
- **E2E Tests (20%)**: Critical user flows with Playwright

### Guiding Principles
1. **Test Behavior, Not Implementation**: Focus on what users see and interact with
2. **User-Centric Queries**: Prefer `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
3. **Integration Over Isolation**: Test components with their hooks and providers
4. **Realistic Mocking**: Use MSW for API mocking to simulate real network behavior
5. **Accessibility First**: Ensure components are testable via ARIA roles and labels

---

## Test Environment Setup

### Vitest Configuration Enhancement

Create a separate config for frontend tests:

**File**: `vitest.config.frontend.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for React component testing
    environment: 'jsdom',

    // Enable global test APIs
    globals: true,

    // Setup file for test utilities
    setupFiles: ['./app/__test-setup__/setup.ts'],

    // Test file patterns
    include: [
      'app/**/__tests__/**/*.test.{ts,tsx}',
      'app/**/*.test.{ts,tsx}'
    ],
    exclude: ['node_modules', 'dist', '.next', 'coverage', 'src/**'],

    // Auto-reset mocks
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,

    // Test timeout
    testTimeout: 10000,

    // Coverage for frontend code
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'app/features/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/__tests__/**',
        '**/__test-helpers__/**',
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/hooks': path.resolve(__dirname, './hooks'),
    },
  },
});
```

### Test Setup File

**File**: `app/__test-setup__/setup.ts`

```typescript
// ABOUTME: Global test setup for frontend tests
// ABOUTME: Configures testing-library, mocks, and global utilities

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from '../__test-helpers__/msw/server';

// MSW Server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (for lazy loading)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
};
```

---

## Component Testing Strategy

### 1. Sidebar Component Testing

**What to Test**:
- Collapse/expand functionality
- Conversation list rendering
- Filter controls interaction
- Empty states
- Error states
- Loading states
- Accessibility (keyboard navigation)

**Test Structure**:

```typescript
// File: app/features/conversation/components/__tests__/Sidebar.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../Sidebar';
import { createTestWrapper } from '@/app/__test-helpers__/wrappers';
import { mockConversationList } from '@/app/__test-helpers__/fixtures/conversations';

describe('Sidebar', () => {
  describe('Rendering', () => {
    it('should render sidebar with conversations list', async () => {
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      // Wait for conversations to load
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /conversations/i }))
          .toBeInTheDocument();
      });

      // Verify conversation items are rendered
      const conversationItems = screen.getAllByRole('button', {
        name: /conversation/i
      });
      expect(conversationItems).toHaveLength(mockConversationList.length);
    });

    it('should show empty state when no conversations exist', async () => {
      const wrapper = createTestWrapper({
        mswHandlers: [handlers.emptyConversationList()]
      });

      render(<Sidebar />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching', () => {
      const wrapper = createTestWrapper({
        mswHandlers: [handlers.slowConversationList()]
      });

      render(<Sidebar />, { wrapper });

      expect(screen.getByRole('status', { name: /loading/i }))
        .toBeInTheDocument();
    });
  });

  describe('Collapse/Expand', () => {
    it('should toggle sidebar collapse on button click', async () => {
      const user = userEvent.setup();
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      const toggleButton = screen.getByRole('button', { name: /collapse/i });

      // Initially expanded
      expect(screen.getByRole('navigation')).toHaveAttribute(
        'aria-expanded',
        'true'
      );

      // Click to collapse
      await user.click(toggleButton);

      expect(screen.getByRole('navigation')).toHaveAttribute(
        'aria-expanded',
        'false'
      );

      // Click to expand
      await user.click(toggleButton);

      expect(screen.getByRole('navigation')).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('should persist collapse state in localStorage', async () => {
      const user = userEvent.setup();
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      const toggleButton = screen.getByRole('button', { name: /collapse/i });
      await user.click(toggleButton);

      expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
    });
  });

  describe('Filter Controls', () => {
    it('should filter conversations by status', async () => {
      const user = userEvent.setup();
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /conversation/i }))
          .toHaveLength(10);
      });

      // Click "Archived" filter
      const archivedFilter = screen.getByRole('radio', {
        name: /archived/i
      });
      await user.click(archivedFilter);

      // Should only show archived conversations
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /conversation/i }))
          .toHaveLength(3);
      });
    });

    it('should show all conversations when "All" filter is selected', async () => {
      const user = userEvent.setup();
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      const allFilter = screen.getByRole('radio', { name: /all/i });
      await user.click(allFilter);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /conversation/i }))
          .toHaveLength(13); // Total conversations
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      const wrapper = createTestWrapper({
        mswHandlers: [handlers.conversationListError()]
      });

      render(<Sidebar />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /failed to load conversations/i
        );
      });
    });

    it('should show retry button on error', async () => {
      const user = userEvent.setup();
      const wrapper = createTestWrapper({
        mswHandlers: [handlers.conversationListError()]
      });

      render(<Sidebar />, { wrapper });

      const retryButton = await screen.findByRole('button', {
        name: /retry/i
      });
      expect(retryButton).toBeInTheDocument();

      // Click retry should refetch
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      await waitFor(() => {
        expect(screen.getAllByRole('button')).toBeDefined();
      });

      // Tab through conversation items
      await user.tab();
      expect(screen.getAllByRole('button')[0]).toHaveFocus();

      await user.tab();
      expect(screen.getAllByRole('button')[1]).toHaveFocus();
    });

    it('should have proper ARIA labels', async () => {
      const wrapper = createTestWrapper();

      render(<Sidebar />, { wrapper });

      await waitFor(() => {
        const navigation = screen.getByRole('navigation', {
          name: /conversations/i
        });
        expect(navigation).toBeInTheDocument();
      });
    });
  });
});
```

### 2. ConversationListItem Component Testing

**What to Test**:
- Click to select conversation
- Delete button interaction
- Active state styling
- Hover states
- Truncated title display
- Timestamp formatting

**Test Pattern**:

```typescript
// File: app/features/conversation/components/__tests__/ConversationListItem.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationListItem } from '../ConversationListItem';
import { createMockConversation } from '@/app/__test-helpers__/factories/conversation';

describe('ConversationListItem', () => {
  it('should render conversation title', () => {
    const conversation = createMockConversation({
      title: 'Test Conversation',
    });

    render(
      <ConversationListItem
        conversation={conversation}
        isActive={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const conversation = createMockConversation();

    render(
      <ConversationListItem
        conversation={conversation}
        isActive={false}
        onClick={handleClick}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', {
      name: new RegExp(conversation.title, 'i')
    }));

    expect(handleClick).toHaveBeenCalledWith(conversation.id);
  });

  it('should call onDelete when delete button clicked', async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();
    const conversation = createMockConversation();

    render(
      <ConversationListItem
        conversation={conversation}
        isActive={false}
        onClick={vi.fn()}
        onDelete={handleDelete}
      />
    );

    // Hover to reveal delete button
    await user.hover(screen.getByRole('button', {
      name: new RegExp(conversation.title, 'i')
    }));

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith(conversation.id);
  });

  it('should apply active styling when isActive is true', () => {
    const conversation = createMockConversation();

    render(
      <ConversationListItem
        conversation={conversation}
        isActive={true}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const button = screen.getByRole('button', {
      name: new RegExp(conversation.title, 'i')
    });

    expect(button).toHaveAttribute('aria-current', 'true');
    expect(button).toHaveClass('bg-accent'); // Or whatever active class
  });

  it('should truncate long titles', () => {
    const longTitle = 'A'.repeat(100);
    const conversation = createMockConversation({ title: longTitle });

    render(
      <ConversationListItem
        conversation={conversation}
        isActive={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const button = screen.getByRole('button');
    expect(button.textContent?.length).toBeLessThan(longTitle.length);
  });

  it('should format timestamp correctly', () => {
    const conversation = createMockConversation({
      updatedAt: '2025-10-08T10:30:00Z',
    });

    render(
      <ConversationListItem
        conversation={conversation}
        isActive={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Expect relative time format (e.g., "2 hours ago")
    expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
  });
});
```

---

## Hook Testing Strategy

### 1. Testing React Query Hooks

**Key Concepts**:
- Use `QueryClientProvider` wrapper with fresh client per test
- Test loading, success, and error states
- Verify cache updates and invalidations
- Test retry logic

**Pattern: useConversationsListQuery**

```typescript
// File: app/features/conversation/hooks/__tests__/useConversationListQuery.test.tsx

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationsListQuery } from '../queries/useConversationQuery';
import { server } from '@/app/__test-helpers__/msw/server';
import { handlers } from '@/app/__test-helpers__/msw/handlers';
import { mockConversationList } from '@/app/__test-helpers__/fixtures/conversations';

describe('useConversationsListQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests
          gcTime: 0,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should fetch conversations list successfully', async () => {
    const { result } = renderHook(() => useConversationsListQuery(), {
      wrapper,
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockConversationList);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors gracefully', async () => {
    server.use(handlers.conversationListError());

    const { result } = renderHook(() => useConversationsListQuery(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });

  it('should respect enabled flag', async () => {
    const { result } = renderHook(
      () => useConversationsListQuery(false), // disabled
      { wrapper }
    );

    // Should not fetch
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();

    // Status should be idle, not loading
    expect(result.current.status).toBe('pending');
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should cache data with correct stale time', async () => {
    const { result, rerender } = renderHook(
      () => useConversationsListQuery(),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstData = result.current.data;

    // Rerender should use cached data
    rerender();

    expect(result.current.data).toBe(firstData);
    expect(result.current.isStale).toBe(false); // Within stale time
  });

  it('should refetch on window focus if stale', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useConversationsListQuery(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Fast-forward past stale time (2 minutes)
    vi.advanceTimersByTime(1000 * 60 * 3);

    expect(result.current.isStale).toBe(true);

    // Simulate window focus (would trigger refetch)
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });

    vi.useRealTimers();
  });
});
```

### 2. Testing Mutations with Optimistic Updates

**Pattern: useDeleteConversationMutation**

```typescript
// File: app/features/conversation/hooks/__tests__/useDeleteConversationMutation.test.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteConversationMutation } from '../mutations/useConversationMutation';
import { conversationKeys } from '../queries/useConversationQuery';
import { server } from '@/app/__test-helpers__/msw/server';
import { handlers } from '@/app/__test-helpers__/msw/handlers';
import { mockConversationList } from '@/app/__test-helpers__/fixtures/conversations';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useDeleteConversationMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
        },
      },
    });

    // Pre-populate cache with conversation list
    queryClient.setQueryData(
      conversationKeys.lists(),
      mockConversationList
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should delete conversation and invalidate cache', async () => {
    const { result } = renderHook(() => useDeleteConversationMutation(), {
      wrapper,
    });

    const conversationId = mockConversationList[0].id;

    // Trigger mutation
    result.current.mutate(conversationId);

    // Should be pending
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Cache should be invalidated
    const cachedData = queryClient.getQueryData(conversationKeys.lists());
    expect(cachedData).toBeDefined();

    // Success toast should be shown
    expect(toast.success).toHaveBeenCalledWith('Conversation deleted');
  });

  it('should optimistically remove conversation from cache', async () => {
    const { result } = renderHook(() => useDeleteConversationMutation(), {
      wrapper,
    });

    const conversationId = mockConversationList[0].id;

    result.current.mutate(conversationId);

    // Immediately after mutation (optimistic update)
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Detail cache should be removed
    const detailCache = queryClient.getQueryData(
      conversationKeys.detail(conversationId)
    );
    expect(detailCache).toBeUndefined();
  });

  it('should handle deletion errors and show toast', async () => {
    server.use(handlers.deleteConversationError());

    const { result } = renderHook(() => useDeleteConversationMutation(), {
      wrapper,
    });

    result.current.mutate('conv_123');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to delete conversation');
  });

  it('should refetch on error to restore state', async () => {
    server.use(handlers.deleteConversationError());

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteConversationMutation(), {
      wrapper,
    });

    result.current.mutate('conv_123');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should invalidate to refetch and restore
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: conversationKeys.detail('conv_123')
    });
  });
});
```

### 3. Testing Enhanced useConversation Hook

**Pattern: useConversation with loadConversation**

```typescript
// File: app/features/conversation/hooks/__tests__/useConversation.test.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversation } from '../useConversation';
import { mockMessages } from '@/app/__test-helpers__/fixtures/messages';

describe('useConversation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.hasMessages).toBe(false);
  });

  it('should load conversation with initial messages', async () => {
    const { result } = renderHook(
      () => useConversation({ initialMessages: mockMessages }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.messages).toEqual(mockMessages);
    });

    expect(result.current.isEmpty).toBe(false);
    expect(result.current.hasMessages).toBe(true);
  });

  it('should track conversation ID from storage', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    expect(result.current.conversationId).toBeDefined();
    expect(result.current.conversationId).toMatch(/^conv_/);
  });

  it('should start new conversation and clear messages', async () => {
    const { result } = renderHook(
      () => useConversation({ initialMessages: mockMessages }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    const oldConversationId = result.current.conversationId;

    act(() => {
      result.current.startNewConversation();
    });

    expect(result.current.conversationId).not.toBe(oldConversationId);
    expect(result.current.messages).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });

  it('should call onConversationStart on first message', async () => {
    const onConversationStart = vi.fn();

    const { result } = renderHook(
      () => useConversation({ onConversationStart }),
      { wrapper }
    );

    await act(async () => {
      result.current.handleSubmit();
    });

    expect(onConversationStart).toHaveBeenCalledWith(
      result.current.conversationId
    );
  });

  it('should derive isThinking state correctly', async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    // Initially not thinking
    expect(result.current.isThinking).toBe(false);

    // TODO: Test thinking state during message submission
    // This requires mocking the streaming API
  });

  it('should handle errors with default handler', async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    // Trigger error by submitting with network failure
    // This would require MSW handler for streaming endpoint
  });

  it('should call custom error handler when provided', async () => {
    const onError = vi.fn();

    const { result } = renderHook(
      () => useConversation({ onError }),
      { wrapper }
    );

    // Trigger error and verify custom handler is called
  });
});
```

---

## Integration Testing Strategy

### 1. Conversation Switching Flow

**Test Scenario**: User clicks conversation in sidebar → Messages load → Chat updates

```typescript
// File: app/features/conversation/__tests__/integration/conversation-switching.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPage } from '@/app/page';
import { createTestWrapper } from '@/app/__test-helpers__/wrappers';
import { mockConversationList } from '@/app/__test-helpers__/fixtures/conversations';
import { mockMessages } from '@/app/__test-helpers__/fixtures/messages';

describe('Conversation Switching Integration', () => {
  it('should switch conversations and load messages', async () => {
    const user = userEvent.setup();
    const wrapper = createTestWrapper();

    render(<ChatPage />, { wrapper });

    // Wait for sidebar to load
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /conversation/i }))
        .toBeDefined();
    });

    const conversationButtons = screen.getAllByRole('button', {
      name: /conversation/i
    });

    // Click second conversation
    await user.click(conversationButtons[1]);

    // Should show loading state
    expect(screen.getByRole('status', { name: /loading/i }))
      .toBeInTheDocument();

    // Wait for messages to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Verify messages are displayed
    const messages = screen.getAllByRole('article');
    expect(messages.length).toBeGreaterThan(0);

    // Verify conversation is marked as active in sidebar
    expect(conversationButtons[1]).toHaveAttribute('aria-current', 'true');
  });

  it('should preserve input when switching conversations', async () => {
    const user = userEvent.setup();
    const wrapper = createTestWrapper();

    render(<ChatPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /message/i }))
        .toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /message/i });

    // Type message
    await user.type(input, 'Unsent message');
    expect(input).toHaveValue('Unsent message');

    // Switch conversation
    const conversationButtons = screen.getAllByRole('button', {
      name: /conversation/i
    });
    await user.click(conversationButtons[1]);

    // Input should be cleared for new conversation
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
```

### 2. Delete Conversation Flow

**Test Scenario**: User deletes conversation → Optimistic update → Refetch → UI updates

```typescript
// File: app/features/conversation/__tests__/integration/delete-conversation.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPage } from '@/app/page';
import { createTestWrapper } from '@/app/__test-helpers__/wrappers';

describe('Delete Conversation Integration', () => {
  it('should delete conversation and update UI', async () => {
    const user = userEvent.setup();
    const wrapper = createTestWrapper();

    render(<ChatPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /conversation/i }))
        .toHaveLength(10);
    });

    const initialCount = screen.getAllByRole('button', {
      name: /conversation/i
    }).length;

    // Hover over first conversation to reveal delete button
    const firstConversation = screen.getAllByRole('button', {
      name: /conversation/i
    })[0];

    await user.hover(firstConversation);

    const deleteButton = within(firstConversation.parentElement!)
      .getByRole('button', { name: /delete/i });

    // Click delete
    await user.click(deleteButton);

    // Confirm deletion in dialog
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/conversation deleted/i)).toBeInTheDocument();
    });

    // Conversation count should decrease
    await waitFor(() => {
      const newCount = screen.getAllByRole('button', {
        name: /conversation/i
      }).length;
      expect(newCount).toBe(initialCount - 1);
    });
  });

  it('should handle delete errors and restore state', async () => {
    const user = userEvent.setup();
    const wrapper = createTestWrapper({
      mswHandlers: [handlers.deleteConversationError()]
    });

    render(<ChatPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /conversation/i }))
        .toBeDefined();
    });

    const initialCount = screen.getAllByRole('button', {
      name: /conversation/i
    }).length;

    // Attempt to delete
    const firstConversation = screen.getAllByRole('button', {
      name: /conversation/i
    })[0];

    await user.hover(firstConversation);

    const deleteButton = within(firstConversation.parentElement!)
      .getByRole('button', { name: /delete/i });

    await user.click(deleteButton);
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // Should show error toast
    await waitFor(() => {
      expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
    });

    // Count should remain the same (state restored)
    expect(screen.getAllByRole('button', { name: /conversation/i }))
      .toHaveLength(initialCount);
  });
});
```

### 3. Filter Changes Flow

```typescript
// File: app/features/conversation/__tests__/integration/filter-conversations.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '@/app/features/conversation/components/Sidebar';
import { createTestWrapper } from '@/app/__test-helpers__/wrappers';

describe('Filter Conversations Integration', () => {
  it('should filter by status and refetch', async () => {
    const user = userEvent.setup();
    const wrapper = createTestWrapper();

    render(<Sidebar />, { wrapper });

    // Wait for all conversations to load
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /conversation/i }))
        .toHaveLength(13);
    });

    // Select "Active" filter
    const activeFilter = screen.getByRole('radio', { name: /active/i });
    await user.click(activeFilter);

    // Should refetch with filter parameter
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /conversation/i }))
        .toHaveLength(10); // Only active conversations
    });

    // Select "Archived" filter
    const archivedFilter = screen.getByRole('radio', { name: /archived/i });
    await user.click(archivedFilter);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /conversation/i }))
        .toHaveLength(3); // Only archived conversations
    });
  });
});
```

---

## Mock Strategy & Patterns

### 1. MSW Setup

**File**: `app/__test-helpers__/msw/server.ts`

```typescript
// ABOUTME: MSW server configuration for API mocking in tests
// ABOUTME: Provides realistic network behavior simulation

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 2. MSW Handlers

**File**: `app/__test-helpers__/msw/handlers.ts`

```typescript
// ABOUTME: MSW request handlers for conversation API endpoints
// ABOUTME: Defines success and error scenarios for all conversation operations

import { http, HttpResponse, delay } from 'msw';
import { mockConversationList } from '../fixtures/conversations';
import { mockMessages } from '../fixtures/messages';

export const handlers = [
  // GET /api/conversations - List all conversations
  http.get('/api/conversations', async () => {
    await delay(100); // Simulate network delay
    return HttpResponse.json(mockConversationList);
  }),

  // GET /api/conversations/:id/messages - Get conversation messages
  http.get('/api/conversations/:id/messages', async ({ params }) => {
    const { id } = params;
    await delay(100);

    // Return messages for specific conversation
    const messages = mockMessages[id as string] || [];
    return HttpResponse.json(messages);
  }),

  // DELETE /api/conversations/:id - Delete conversation
  http.delete('/api/conversations/:id', async () => {
    await delay(100);
    return HttpResponse.json({ success: true });
  }),

  // POST /api/conversations - Create conversation
  http.post('/api/conversations', async () => {
    await delay(100);
    return HttpResponse.json({
      conversationId: 'conv_new_123'
    });
  }),

  // PATCH /api/conversations/:id - Update conversation
  http.patch('/api/conversations/:id', async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true });
  }),
];

// Error handlers for specific test scenarios
export const errorHandlers = {
  conversationListError: () =>
    http.get('/api/conversations', async () => {
      await delay(100);
      return HttpResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }),

  deleteConversationError: () =>
    http.delete('/api/conversations/:id', async () => {
      await delay(100);
      return HttpResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }),

  conversationNotFound: (conversationId: string) =>
    http.get(`/api/conversations/${conversationId}/messages`, async () => {
      return HttpResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }),

  slowConversationList: () =>
    http.get('/api/conversations', async () => {
      await delay(5000); // Slow response
      return HttpResponse.json(mockConversationList);
    }),

  emptyConversationList: () =>
    http.get('/api/conversations', async () => {
      await delay(100);
      return HttpResponse.json([]);
    }),
};
```

### 3. Test Fixtures

**File**: `app/__test-helpers__/fixtures/conversations.ts`

```typescript
// ABOUTME: Mock conversation data for testing
// ABOUTME: Provides realistic conversation objects with various states

import type { Conversation } from '@/app/features/conversation/data/schemas/conversation.schema';

export const mockConversationList: Conversation[] = [
  {
    id: 'conv_001',
    title: 'Weather in San Francisco',
    status: 'active',
    createdAt: '2025-10-08T08:00:00Z',
    updatedAt: '2025-10-08T09:30:00Z',
    metadata: {
      messageCount: 4,
      lastMessageAt: '2025-10-08T09:30:00Z',
    },
  },
  {
    id: 'conv_002',
    title: 'How to use React Query',
    status: 'active',
    createdAt: '2025-10-07T14:20:00Z',
    updatedAt: '2025-10-07T15:45:00Z',
    metadata: {
      messageCount: 8,
      lastMessageAt: '2025-10-07T15:45:00Z',
    },
  },
  {
    id: 'conv_003',
    title: 'MongoDB connection issues',
    status: 'archived',
    createdAt: '2025-10-06T10:00:00Z',
    updatedAt: '2025-10-06T11:00:00Z',
    metadata: {
      messageCount: 6,
      lastMessageAt: '2025-10-06T11:00:00Z',
    },
  },
  // ... more conversations
];

export const createMockConversation = (
  overrides?: Partial<Conversation>
): Conversation => ({
  id: 'conv_mock',
  title: 'Mock Conversation',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: {
    messageCount: 0,
    lastMessageAt: new Date().toISOString(),
  },
  ...overrides,
});
```

**File**: `app/__test-helpers__/fixtures/messages.ts`

```typescript
// ABOUTME: Mock message data for testing conversation history
// ABOUTME: Provides realistic message arrays for different conversations

import type { Message } from 'ai';

export const mockMessages: Record<string, Message[]> = {
  'conv_001': [
    {
      id: 'msg_001',
      role: 'user',
      content: 'What is the weather in San Francisco?',
      createdAt: new Date('2025-10-08T08:00:00Z'),
    },
    {
      id: 'msg_002',
      role: 'assistant',
      content: 'The current weather in San Francisco is...',
      createdAt: new Date('2025-10-08T08:01:00Z'),
    },
  ],
  'conv_002': [
    {
      id: 'msg_003',
      role: 'user',
      content: 'How do I use React Query?',
      createdAt: new Date('2025-10-07T14:20:00Z'),
    },
    {
      id: 'msg_004',
      role: 'assistant',
      content: 'React Query is a powerful data fetching library...',
      createdAt: new Date('2025-10-07T14:21:00Z'),
    },
  ],
};

export const createMockMessage = (
  overrides?: Partial<Message>
): Message => ({
  id: 'msg_mock',
  role: 'user',
  content: 'Mock message',
  createdAt: new Date(),
  ...overrides,
});
```

### 4. Test Wrappers

**File**: `app/__test-helpers__/wrappers.tsx`

```typescript
// ABOUTME: Reusable test wrapper for React Query and other providers
// ABOUTME: Centralizes provider setup for consistent test environment

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

interface TestWrapperOptions {
  queryClient?: QueryClient;
  mswHandlers?: any[];
}

export function createTestWrapper(options: TestWrapperOptions = {}) {
  const {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    }),
    mswHandlers = [],
  } = options;

  // Apply MSW handlers if provided
  if (mswHandlers.length > 0) {
    const { server } = require('./msw/server');
    server.use(...mswHandlers);
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}
```

---

## E2E Testing with Playwright

### 1. Setup Playwright

**Installation**:
```bash
yarn add -D @playwright/test
npx playwright install
```

**Configuration**: `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. Database Seeding for E2E

**File**: `e2e/helpers/db-seed.ts`

```typescript
// ABOUTME: Database seeding utilities for E2E tests
// ABOUTME: Provides test data setup and teardown for isolated test runs

import { MongoClient } from 'mongodb';

export class TestDatabase {
  private client: MongoClient;
  private dbName: string = 'test_nextjs_ai_chat';

  constructor(mongoUrl: string) {
    this.client = new MongoClient(mongoUrl);
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.close();
  }

  async seedConversations(conversations: any[]) {
    const db = this.client.db(this.dbName);
    const collection = db.collection('conversations');

    await collection.deleteMany({}); // Clear existing
    await collection.insertMany(conversations);
  }

  async clearConversations() {
    const db = this.client.db(this.dbName);
    await db.collection('conversations').deleteMany({});
  }

  async getConversationCount(): Promise<number> {
    const db = this.client.db(this.dbName);
    return await db.collection('conversations').countDocuments();
  }
}
```

### 3. E2E Test Scenarios

**File**: `e2e/conversation-history.spec.ts`

```typescript
// ABOUTME: E2E tests for conversation history feature
// ABOUTME: Tests critical user flows with real database and API

import { test, expect } from '@playwright/test';
import { TestDatabase } from './helpers/db-seed';
import { mockConversationList } from '../app/__test-helpers__/fixtures/conversations';

let testDb: TestDatabase;

test.beforeAll(async () => {
  testDb = new TestDatabase(process.env.MONGODB_URL!);
  await testDb.connect();
});

test.afterAll(async () => {
  await testDb.clearConversations();
  await testDb.disconnect();
});

test.describe('Conversation History - User Flows', () => {
  test.beforeEach(async () => {
    // Seed database with test conversations
    await testDb.seedConversations(mockConversationList);
  });

  test('User can view conversation list in sidebar', async ({ page }) => {
    await page.goto('/');

    // Wait for sidebar to load
    await page.waitForSelector('[data-testid="sidebar"]');

    // Verify conversations are displayed
    const conversations = await page.locator('[data-testid="conversation-item"]');
    await expect(conversations).toHaveCount(mockConversationList.length);
  });

  test('User can switch between conversations', async ({ page }) => {
    await page.goto('/');

    // Click on second conversation
    await page.locator('[data-testid="conversation-item"]').nth(1).click();

    // Wait for messages to load
    await page.waitForSelector('[data-testid="message"]');

    // Verify messages are displayed
    const messages = await page.locator('[data-testid="message"]');
    await expect(messages.count()).toBeGreaterThan(0);

    // Verify active state in sidebar
    const activeConversation = page.locator('[data-testid="conversation-item"][aria-current="true"]');
    await expect(activeConversation).toBeVisible();
  });

  test('User can delete a conversation', async ({ page }) => {
    await page.goto('/');

    const initialCount = await page.locator('[data-testid="conversation-item"]').count();

    // Hover over first conversation
    await page.locator('[data-testid="conversation-item"]').first().hover();

    // Click delete button
    await page.locator('[data-testid="delete-conversation"]').first().click();

    // Confirm deletion
    await page.locator('button:has-text("Confirm")').click();

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // Verify conversation count decreased
    const newCount = await page.locator('[data-testid="conversation-item"]').count();
    expect(newCount).toBe(initialCount - 1);

    // Verify database
    const dbCount = await testDb.getConversationCount();
    expect(dbCount).toBe(initialCount - 1);
  });

  test('User can filter conversations by status', async ({ page }) => {
    await page.goto('/');

    // Click "Active" filter
    await page.locator('input[type="radio"][value="active"]').check();

    // Wait for filtered results
    await page.waitForTimeout(300);

    // Verify only active conversations are shown
    const activeConversations = await page.locator('[data-testid="conversation-item"]').count();
    const expectedActive = mockConversationList.filter(c => c.status === 'active').length;
    expect(activeConversations).toBe(expectedActive);
  });

  test('User can create new conversation', async ({ page }) => {
    await page.goto('/');

    const initialCount = await page.locator('[data-testid="conversation-item"]').count();

    // Click new conversation button
    await page.locator('[data-testid="new-conversation"]').click();

    // Type a message
    await page.fill('[data-testid="message-input"]', 'Hello, new conversation!');
    await page.locator('[data-testid="send-message"]').click();

    // Wait for conversation to be created
    await page.waitForSelector('[data-testid="message"]');

    // Verify conversation appears in sidebar
    const newCount = await page.locator('[data-testid="conversation-item"]').count();
    expect(newCount).toBe(initialCount + 1);

    // Verify persistence in database
    const dbCount = await testDb.getConversationCount();
    expect(dbCount).toBe(initialCount + 1);
  });

  test('Conversation persists after page reload', async ({ page }) => {
    await page.goto('/');

    // Select a conversation
    await page.locator('[data-testid="conversation-item"]').first().click();
    await page.waitForSelector('[data-testid="message"]');

    const conversationTitle = await page.locator('[data-testid="conversation-item"]').first().textContent();

    // Reload page
    await page.reload();

    // Verify same conversation is still active
    await page.waitForSelector('[data-testid="message"]');
    const activeTitle = await page.locator('[data-testid="conversation-item"][aria-current="true"]').textContent();
    expect(activeTitle).toBe(conversationTitle);
  });
});
```

---

## Test Utilities & Helpers

### 1. Factory Functions

**File**: `app/__test-helpers__/factories/conversation.ts`

```typescript
// ABOUTME: Factory functions for creating test conversation objects
// ABOUTME: Provides flexible conversation creation with sensible defaults

import type { Conversation } from '@/app/features/conversation/data/schemas/conversation.schema';

let conversationIdCounter = 1;

export function createMockConversation(
  overrides?: Partial<Conversation>
): Conversation {
  const id = `conv_test_${conversationIdCounter++}`;

  return {
    id,
    title: `Test Conversation ${conversationIdCounter}`,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      messageCount: 0,
      lastMessageAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

export function createMockConversationList(count: number): Conversation[] {
  return Array.from({ length: count }, (_, i) =>
    createMockConversation({
      title: `Conversation ${i + 1}`,
    })
  );
}

export function createArchivedConversation(
  overrides?: Partial<Conversation>
): Conversation {
  return createMockConversation({
    status: 'archived',
    ...overrides,
  });
}
```

### 2. Custom Render Utilities

**File**: `app/__test-helpers__/custom-render.tsx`

```typescript
// ABOUTME: Custom render function with all necessary providers
// ABOUTME: Simplifies component testing by wrapping common setup

import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement, ReactNode } from 'react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  } = options;

  const Wrapper = createWrapper(queryClient);

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };
```

### 3. Query Client Test Utilities

**File**: `app/__test-helpers__/query-client-utils.ts`

```typescript
// ABOUTME: Utilities for testing React Query cache and state
// ABOUTME: Helpers for verifying query data, invalidation, and mutations

import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';

export async function waitForQueryToSucceed(
  queryClient: QueryClient,
  queryKey: any[]
) {
  await waitFor(() => {
    const state = queryClient.getQueryState(queryKey);
    expect(state?.status).toBe('success');
  });
}

export async function waitForQueryToError(
  queryClient: QueryClient,
  queryKey: any[]
) {
  await waitFor(() => {
    const state = queryClient.getQueryState(queryKey);
    expect(state?.status).toBe('error');
  });
}

export function getQueryData<T>(
  queryClient: QueryClient,
  queryKey: any[]
): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

export function setQueryData<T>(
  queryClient: QueryClient,
  queryKey: any[],
  data: T
) {
  queryClient.setQueryData(queryKey, data);
}

export async function invalidateQueries(
  queryClient: QueryClient,
  queryKey: any[]
) {
  await queryClient.invalidateQueries({ queryKey });
}
```

---

## Coverage Requirements

### Target Metrics
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### Coverage Focus Areas
1. **Critical Paths**: Conversation switching, deletion, creation
2. **Error Handling**: Network failures, 404s, validation errors
3. **Edge Cases**: Empty states, loading states, concurrent operations
4. **User Interactions**: Click, hover, keyboard navigation

### Running Coverage

```bash
# Frontend tests with coverage
yarn test:coverage

# View HTML report
open coverage/index.html
```

---

## Common Pitfalls & Solutions

### 1. **Pitfall**: Tests fail due to async state updates

**Solution**: Use `waitFor` and `findBy` queries

```typescript
// ❌ Bad - doesn't wait for async updates
expect(screen.getByText('Loaded')).toBeInTheDocument();

// ✅ Good - waits for element to appear
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// ✅ Better - use findBy (implicit waitFor)
expect(await screen.findByText('Loaded')).toBeInTheDocument();
```

### 2. **Pitfall**: React Query cache pollution between tests

**Solution**: Create fresh QueryClient for each test

```typescript
describe('MyComponent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  // Tests use fresh queryClient
});
```

### 3. **Pitfall**: MSW handlers not being reset

**Solution**: Use `server.resetHandlers()` in `afterEach`

```typescript
afterEach(() => {
  server.resetHandlers(); // Reset to default handlers
});
```

### 4. **Pitfall**: Testing implementation details

**Solution**: Test user-visible behavior

```typescript
// ❌ Bad - testing implementation
expect(component.state.isLoading).toBe(false);

// ✅ Good - testing user-visible outcome
expect(screen.queryByRole('status')).not.toBeInTheDocument();
```

### 5. **Pitfall**: Not cleaning up side effects

**Solution**: Use `cleanup()` and restore mocks

```typescript
afterEach(() => {
  cleanup(); // Clean up rendered components
  vi.clearAllMocks(); // Clear mock call history
  vi.restoreAllMocks(); // Restore original implementations
});
```

### 6. **Pitfall**: Race conditions in React Query tests

**Solution**: Wait for query state changes

```typescript
// ✅ Wait for query to complete
await waitFor(() => {
  expect(result.current.isSuccess).toBe(true);
});

// Then assert on data
expect(result.current.data).toEqual(expectedData);
```

### 7. **Pitfall**: Incorrect userEvent usage

**Solution**: Always `await` userEvent interactions

```typescript
// ❌ Bad - missing await
user.click(button);

// ✅ Good - await async action
await user.click(button);
```

---

## Summary

This testing strategy provides:

1. **Comprehensive Coverage**: Unit, integration, and E2E tests
2. **Realistic Mocking**: MSW for API simulation
3. **Maintainable Tests**: Reusable helpers and factories
4. **User-Centric Testing**: Focus on behavior over implementation
5. **Fast Feedback**: Optimized test execution with Vitest

**Key Takeaways**:
- Test behavior, not implementation details
- Use MSW for realistic API mocking
- Create fresh QueryClient instances per test
- Always await async operations
- Focus on critical user flows in E2E tests
- Maintain 80%+ coverage for frontend code

**Next Steps**:
1. Set up Vitest config for frontend tests
2. Create MSW handlers and fixtures
3. Implement component tests for Sidebar and ConversationListItem
4. Add hook tests for React Query hooks
5. Write integration tests for user flows
6. Set up Playwright for E2E tests (optional but recommended)

This strategy ensures robust, maintainable tests that give confidence in the conversation history feature implementation.
