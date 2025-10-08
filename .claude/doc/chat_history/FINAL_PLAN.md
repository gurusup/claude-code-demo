# Chat History Feature - Final Implementation Plan

**Date**: 2025-10-08
**Status**: ✅ Planning Complete - Ready for Implementation
**Session**: `context_session_chat_history`

---

## Executive Summary

This document consolidates all architectural advice from 6 specialized subagents into a single, actionable implementation plan for adding persistent chat history with MongoDB Atlas and a collapsible sidebar UI.

**Total Planning Documents**: 7 comprehensive documents (~30,000 words)
**Total Test Scenarios Defined**: 135 (105 unit + 15 integration + 15 E2E)
**Implementation Timeline**: 2-3 weeks (4 phases)

---

## User Requirements (Confirmed by Fran)

✅ MongoDB Atlas (cloud deployment)
✅ Hard delete (no recovery)
✅ Collapsible sidebar (hamburger menu, all screen sizes)
✅ Show 50-100 recent conversations
✅ Keep InMemory repository for testing (env-based switching)
✅ Filter by status only (Active/Archived) - no search initially

---

## Implementation Phases

### **Phase 1: Backend Infrastructure** (Week 1)
**Estimated Time**: 5-7 days
**Lead**: hexagonal-backend-architect + backend-test-architect

#### 1.1 Dependencies
```bash
yarn add mongodb
yarn add -D mongodb-memory-server
```

#### 1.2 MongoDB Connection Manager
**File**: `src/infrastructure/adapters/database/MongoDBClient.ts`
- Singleton pattern with connection pooling (MaxPoolSize=10)
- Retry logic with exponential backoff (3 attempts)
- Health check via ping command
- Environment variables: `MONGODB_URL`, `DATABASE_NAME`

#### 1.3 Document Schema & Mapper
**Files**:
- `src/infrastructure/adapters/database/types/ConversationDocument.ts` (TypeScript interfaces)
- `src/infrastructure/adapters/database/mappers/ConversationDocumentMapper.ts` (entity ↔ document)

**Schema**:
```typescript
{
  _id: string,  // UUID v4
  messages: Message[],  // Embedded (not referenced)
  status: 'active' | 'waiting_for_response' | 'completed' | 'archived',
  title?: string,
  createdAt: Date,  // MongoDB Date object (NOT ISO string)
  updatedAt: Date,
  metadata: Record<string, any>
}
```

**Indexes**:
1. `{ _id: 1 }` - Auto primary
2. `{ updatedAt: -1 }` - Sort by recent
3. `{ status: 1, updatedAt: -1 }` - Filter + sort

#### 1.4 MongoDB Repository
**File**: `src/infrastructure/repositories/MongoDBConversationRepository.ts`

Implements `IConversationRepository`:
- `save()` - Upsert with `replaceOne({ _id }, { upsert: true })`
- `findById()` - Use mapper to restore entity with `Conversation.restore()` (**CRITICAL**: NOT `.create()`)
- `findAll(options)` - Pagination with projection (exclude `messages` array for list views)
- `delete()` - Hard delete with `deleteOne()`
- `count()`, `findActive()`, `archiveOlderThan()`

#### 1.5 Dependency Injection Updates
**File**: `src/infrastructure/config/DependencyContainer.ts`

**Changes**:
1. Make `initializeAdapters()` async
2. Replace `getInstance()` with async `create()` factory
3. Add repository selection based on `REPOSITORY_TYPE` env var
4. Graceful fallback: MongoDB failure → InMemory + warning log

**Update ALL API routes** to await container:
```typescript
const container = await DependencyContainer.create({ enableLogging: true });
```

#### 1.6 Backend Tests
**Files**:
- `tests/unit/infrastructure/repositories/MongoDBConversationRepository.unit.test.ts` (mocked MongoDB)
- `tests/integration/infrastructure/repositories/MongoDBConversationRepository.integration.test.ts` (mongodb-memory-server)
- `tests/unit/infrastructure/mappers/ConversationDocumentMapper.test.ts`
- `tests/unit/application/use-cases/ListConversationsUseCase.test.ts`

**Coverage Targets**: 95% domain, 90% use cases, 80% infrastructure

---

### **Phase 2: Backend API Endpoints** (Week 1-2)
**Estimated Time**: 3-4 days
**Lead**: hexagonal-backend-architect

#### 2.1 New API Routes
**File**: `app/api/conversations/list/route.ts`
```typescript
GET /api/conversations/list?status=active&limit=100&offset=0
```

**Response**:
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "First conversation",
      "status": "active",
      "messageCount": 15,
      "lastMessage": {
        "role": "assistant",
        "preview": "Sure, I can help with that..."
      },
      "createdAt": "2025-10-08T12:34:56.789Z",  // ISO 8601 string
      "updatedAt": "2025-10-08T14:20:10.123Z"
    }
  ],
  "total": 42
}
```

**File**: `app/api/conversations/[id]/route.ts`
```typescript
GET /api/conversations/:id          // Load conversation messages
DELETE /api/conversations/:id       // Hard delete
PATCH /api/conversations/:id        // Update title/metadata
```

#### 2.2 Use Cases
**File**: `src/application/use-cases/ListConversationsUseCase.ts`
- Constructor injection: `IConversationRepository`
- Delegates to `repository.findAll({ status, limit, offset })`
- Returns DTOs (not domain entities)

#### 2.3 API Tests
- Integration tests for each route (mocked use cases)
- E2E tests against MongoDB Atlas test cluster

---

### **Phase 3: Frontend Data Layer** (Week 2)
**Estimated Time**: 4-5 days
**Lead**: frontend-developer + frontend-test-engineer

#### 3.1 Service Layer
**File**: `app/features/conversation/data/services/conversation.service.ts`

**Enhanced Methods**:
```typescript
listConversations(options?: { status?, limit?, offset? }): Promise<ConversationListResponse>
getConversationHistory(id: string): Promise<ConversationMessagesResponse>
deleteConversation(id: string): Promise<void>
```

**Error Handling**: Custom `ConversationServiceError` with status code classification

#### 3.2 React Query Hooks
**File**: `app/features/conversation/hooks/queries/useConversationQuery.ts`

**New Hooks**:
```typescript
useConversationsListQuery(status?: 'active' | 'archived', options?)
useConversationMessagesQuery(conversationId: string, options?)
usePrefetchConversation(conversationId: string)  // Hover trigger
```

**Query Keys**:
```typescript
conversationKeys = {
  all: ['conversations'],
  lists: () => [...conversationKeys.all, 'list'],
  list: (filters) => [...conversationKeys.lists(), filters],
  detail: (id) => [...conversationKeys.all, 'detail', id],
  messages: (id) => [...conversationKeys.detail(id), 'messages']
}
```

**Cache Strategy**:
- List: 2min stale, 10min gc, refetch on mount
- Messages: 5min stale, 30min gc, no refetch on mount

#### 3.3 Mutation Hooks
**File**: `app/features/conversation/hooks/mutations/useConversationMutation.ts`

**Enhanced Delete**:
```typescript
useDeleteConversationMutation({
  onMutate: (id) => {
    // Optimistic update: remove from cache
    const previousConversations = queryClient.getQueryData(conversationKeys.lists());
    queryClient.setQueryData(conversationKeys.lists(), (old) =>
      old.filter(c => c.id !== id)
    );
    return { previousConversations };
  },
  onError: (error, id, context) => {
    // Rollback on error
    queryClient.setQueryData(conversationKeys.lists(), context.previousConversations);
    toast.error('Failed to delete conversation');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    toast.success('Conversation deleted');
  }
})
```

#### 3.4 Business Hook
**File**: `app/features/conversation/hooks/useSwitchConversation.ts`

**Orchestrates**:
1. Prefetch messages (if not in cache)
2. Update `conversationStorage`
3. Clear current messages (`setMessages([])`)
4. Load new messages
5. Handle errors with toast notifications

#### 3.5 Enhanced useConversation
**File**: `app/features/conversation/hooks/useConversation.tsx`

**New Method**:
```typescript
async loadConversation(conversationId: string) {
  setIsLoadingConversation(true);
  setLoadError(null);

  try {
    // Fetch conversation messages
    const history = await conversationService.getConversationHistory(conversationId);

    // Update storage
    storage.setConversationId(conversationId);

    // Clear current messages (CRITICAL for Vercel AI SDK)
    setMessages([]);

    // Load new messages
    setMessages(history.messages);
  } catch (error) {
    setLoadError(error);
    toast.error('Failed to load conversation');
  } finally {
    setIsLoadingConversation(false);
  }
}
```

**New State**:
- `isLoadingConversation: boolean`
- `loadError: Error | null`

#### 3.6 Frontend Tests
**Files**:
- `app/features/conversation/hooks/__tests__/useConversationListQuery.test.tsx`
- `app/features/conversation/hooks/__tests__/useDeleteConversationMutation.test.tsx`
- `app/features/conversation/hooks/__tests__/useSwitchConversation.test.tsx`

**Setup**: MSW for API mocking
```bash
yarn add -D msw@latest
```

**MSW Handlers**:
- `GET /api/conversations/list` (success, error, slow, empty)
- `GET /api/conversations/:id` (success, 404, error)
- `DELETE /api/conversations/:id` (success, error)

**Coverage Target**: 80%+ statements

---

### **Phase 4: Frontend UI Components** (Week 2-3)
**Estimated Time**: 5-6 days
**Lead**: shadcn-ui-architect + ui-ux-analyzer

#### 4.1 Sidebar Component Architecture
**Files** (6 new components):
```
app/features/conversation/components/
├── conversation-sidebar.tsx           # Main sidebar wrapper
├── conversation-sidebar-header.tsx    # New Chat + Filters
├── conversation-list.tsx              # List container
├── conversation-list-item.tsx         # Individual item
├── conversation-list-skeleton.tsx     # Loading state
└── conversation-empty-state.tsx       # Empty state
```

#### 4.2 Component Selection (shadcn/ui v4)
- **Sidebar**: `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`
- **List**: `ScrollArea` (no virtualization for 100 items)
- **Actions**: `Button` (New Chat: default, Delete: ghost+icon)
- **Status**: `Badge` (Archived only)
- **Confirmation**: `AlertDialog` (delete confirmation)

#### 4.3 ConversationSidebar (Main Component)
```tsx
<Sidebar collapsible="icon">
  <SidebarHeader>
    <Button onClick={startNewConversation}>
      <Plus /> New Chat
    </Button>
    <FilterButtons />  {/* All | Active | Archived */}
  </SidebarHeader>

  <SidebarContent>
    <ScrollArea>
      {isLoading && <ConversationListSkeleton />}
      {isEmpty && <ConversationEmptyState />}
      {error && <ConversationErrorState />}
      {conversations.map(conv => (
        <ConversationListItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeId}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      ))}
    </ScrollArea>
  </SidebarContent>
</Sidebar>
```

#### 4.4 ConversationListItem Design
**Layout**:
```
┌─────────────────────────────────────────┐
│ [Title]                          [Delete]│
│ Last message preview...                  │
│ 2:30 PM                      [Badge]     │
└─────────────────────────────────────────┘
```

**Specs**:
- Width: 280px (expanded), 56px (icon mode)
- Title: Single line, truncate with tooltip
- Preview: 60-80 chars, single line
- Timestamp: `date-fns` formatting ("2:30 PM", "Yesterday", "Jan 15")
- Delete: Ghost button, show on hover (desktop), always visible (mobile)
- Active state: `bg-secondary` + left border accent

#### 4.5 Responsive Behavior
**Mobile (<768px)**:
- Overlay mode, full width (80-100vw)
- Backdrop with blur
- Swipe to close gesture
- Auto-close after selection

**Desktop (≥768px)**:
- Persistent sidebar
- Icon collapse mode (56px)
- Hover to expand
- State persistence (localStorage: `sidebarOpen`)

#### 4.6 States
**Loading**: 5 skeleton conversation items
**Empty**: Icon + "No conversations yet" + "Start chatting" CTA
**Error**: AlertCircle + error message + Retry button
**Active**: Highlighted background + blue left border

#### 4.7 Layout Integration
**File**: `app/layout.tsx` or `app/(chat)/layout.tsx`

```tsx
<SidebarProvider defaultOpen={true}>
  <ConversationSidebar />
  <SidebarInset>
    <Navbar>
      <SidebarTrigger />  {/* Hamburger menu */}
    </Navbar>
    {children}
  </SidebarInset>
</SidebarProvider>
```

#### 4.8 Accessibility (WCAG 2.1 AA)
- Keyboard navigation (Tab, Arrow keys, Enter/Space, ESC)
- ARIA labels (`aria-label`, `aria-current`, `aria-live`)
- Screen reader announcements (live regions)
- Focus management (trap on mobile)
- Color contrast 4.5:1 ratio
- Keyboard shortcut: Cmd/Ctrl+B to toggle

#### 4.9 Frontend Component Tests
**Files**:
- `app/features/conversation/components/__tests__/Sidebar.test.tsx`
- `app/features/conversation/components/__tests__/ConversationListItem.test.tsx`

**Test Coverage**:
- Render with conversations
- Click to load conversation
- Delete with confirmation
- Filter by status
- Empty/loading/error states
- Keyboard navigation
- Responsive behavior (mobile/desktop)

---

## Environment Variables

**File**: `.env.example`
```bash
# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# MongoDB Atlas
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/
DATABASE_NAME=ai_chat_app

# Repository Selection
REPOSITORY_TYPE=mongodb  # or 'inmemory' for testing
```

**File**: `.env.local` (not committed, Fran creates this)
```bash
OPENAI_API_KEY=sk-...
MONGODB_URL=mongodb+srv://fran:...@cluster.mongodb.net/
DATABASE_NAME=ai_chat_prod
REPOSITORY_TYPE=mongodb
```

---

## Testing Strategy

### Backend Testing
**Tools**: Vitest, mongodb-memory-server

**Unit Tests** (Mocked MongoDB):
- `MongoDBConversationRepository.unit.test.ts` - Mock MongoDB client
- `ConversationDocumentMapper.test.ts` - Round-trip mapping
- Use cases - Mock repository

**Integration Tests** (Real MongoDB):
- `MongoDBConversationRepository.integration.test.ts` - mongodb-memory-server
- Full CRUD lifecycle
- Pagination, filtering, concurrent updates

**Coverage**: 95% domain, 90% use cases, 80% infrastructure

### Frontend Testing
**Tools**: Vitest, React Testing Library, MSW

**Unit Tests**:
- Query hooks (list, messages)
- Mutation hooks (delete with optimistic updates)
- Components (Sidebar, ConversationListItem)

**Integration Tests**:
- Conversation switching flow
- Delete + refetch flow
- Filter changes + query updates

**Coverage**: 80%+ statements

### E2E Testing
**Decision**: ❌ **Skipped per Fran's request**
- Focus on comprehensive unit and integration tests
- Manual testing will cover critical user flows
- Can add Playwright tests in future if needed

---

## Acceptance Criteria (75+ Scenarios)

### Critical Quality Gates (MUST PASS)
1. ✅ Zero message loss (100% persistence)
2. ✅ No duplicate conversations (UUID v4 uniqueness)
3. ✅ Correct message ordering (server timestamps)
4. ✅ Load time <2s for list, <1.5s for conversation
5. ✅ Hard delete with confirmation
6. ✅ MongoDB connection resilience (fallback to InMemory on startup)

### Important (SHOULD PASS)
7. ✅ Sidebar 60fps animations (300ms transition)
8. ✅ WCAG 2.1 AA accessibility
9. ✅ Error auto-recovery 90% success rate
10. ✅ Responsive design (mobile overlay, desktop collapsible)

**Full Criteria**: `.claude/doc/chat_history/acceptance-criteria.md` (8 functional areas, 75+ scenarios)

---

## Performance Targets

**Load Times**:
- Conversation list: <2 seconds (P95)
- Single conversation: <1.5 seconds (P95)
- Sidebar toggle: 300ms animation

**Responsiveness**:
- Sidebar animations: 60fps
- Scroll performance: Smooth (no jank)
- Message rendering: <100ms per message

**Database**:
- `findById()`: O(1) - Primary index
- `findAll()`: O(log n) - Compound index
- Connection pool: MaxPoolSize=10 (serverless)

**Memory**:
- Long sessions: <200MB heap
- Conversation cache: 10min GC for list, 30min for messages

---

## File Structure Summary

### Backend (NEW)
```
src/infrastructure/
├── adapters/database/
│   ├── MongoDBClient.ts
│   ├── MongoDBConversationRepository.ts
│   ├── types/ConversationDocument.ts
│   └── mappers/ConversationDocumentMapper.ts
└── config/
    └── DependencyContainer.ts  [MODIFIED - async init]

app/api/
├── conversations/
│   ├── list/route.ts  [NEW]
│   └── [id]/route.ts  [NEW]
└── health/route.ts  [NEW]
```

### Backend Tests (NEW)
```
tests/
├── unit/
│   ├── infrastructure/repositories/
│   │   └── MongoDBConversationRepository.unit.test.ts
│   ├── infrastructure/mappers/
│   │   └── ConversationDocumentMapper.test.ts
│   └── application/use-cases/
│       └── ListConversationsUseCase.test.ts
└── integration/
    └── infrastructure/repositories/
        └── MongoDBConversationRepository.integration.test.ts
```

### Frontend (NEW)
```
app/features/conversation/
├── components/
│   ├── conversation-sidebar.tsx
│   ├── conversation-sidebar-header.tsx
│   ├── conversation-list.tsx
│   ├── conversation-list-item.tsx
│   ├── conversation-list-skeleton.tsx
│   └── conversation-empty-state.tsx
├── hooks/
│   ├── queries/useConversationQuery.ts  [MODIFIED - add list query]
│   ├── mutations/useConversationMutation.ts  [MODIFIED - enhance delete]
│   ├── useSwitchConversation.ts  [NEW]
│   └── useConversation.tsx  [MODIFIED - add loadConversation]
└── data/services/
    └── conversation.service.ts  [MODIFIED - add listConversations]
```

### Frontend Tests (NEW)
```
app/features/conversation/
├── components/__tests__/
│   ├── Sidebar.test.tsx
│   └── ConversationListItem.test.tsx
├── hooks/__tests__/
│   ├── useConversationListQuery.test.tsx
│   ├── useDeleteConversationMutation.test.tsx
│   └── useSwitchConversation.test.tsx
└── __tests__/integration/
    ├── conversation-switching.test.tsx
    ├── delete-conversation.test.tsx
    └── filter-conversations.test.tsx

app/__test-helpers__/
├── msw/
│   ├── server.ts
│   └── handlers.ts
├── fixtures/conversations.ts
├── factories/conversation.ts
└── wrappers.tsx
```

### E2E Tests (NEW)
```
e2e/
└── conversation-history.spec.ts  (15 scenarios)
```

---

## Critical Implementation Notes

### Backend ⚠️
1. **Use `Conversation.restore()`** when mapping from MongoDB - NEVER `.create()` (bypasses domain validation)
2. **Tool Invocation State Machine** - Manually replay state transitions when restoring
3. **Async Container** - Update ALL API routes to `await DependencyContainer.create()`
4. **Date Objects** - Keep MongoDB dates as Date objects (NOT ISO strings)
5. **Fallback Strategy** - Startup fallback only (MongoDB failure → InMemory with warning)
6. **Index Creation** - Call `createIndexes()` once on repository initialization
7. **Connection Pooling** - MaxPoolSize=10 for serverless environments

### Frontend ⚠️
1. **React Query v5** - Use `gcTime` (not `cacheTime`), `isPending` (not `isLoading`)
2. **Vercel AI SDK** - MUST call `setMessages([])` before loading new conversation
3. **Date Serialization** - Backend MUST return ISO 8601 strings (Zod schema expects strings)
4. **Optimistic Delete** - Implement rollback on error (restore previous cache state)
5. **SidebarProvider** - Must wrap entire app in layout.tsx
6. **Focus Management** - Built-in focus trap on mobile (useSidebar hook)
7. **SessionStorage** - Active conversation ID persists per tab (intentional)

---

## MongoDB Atlas Setup

### 1. Create Free Cluster (M0)
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create account (if needed)
3. Create new project: "AI Chat App"
4. Build Database → Shared (FREE) → Create
5. Choose provider: AWS, Region: Nearest to you
6. Cluster name: "ai-chat-cluster"

### 2. Configure Database Access
1. Database Access → Add New Database User
2. Username: `ai_chat_user`
3. Password: Generate secure password (save it!)
4. Database User Privileges: "Read and write to any database"

### 3. Configure Network Access
1. Network Access → Add IP Address
2. Option A: Allow access from anywhere (0.0.0.0/0) - **Development only**
3. Option B: Add your current IP - **More secure**

### 4. Get Connection String
1. Clusters → Connect → Connect your application
2. Driver: Node.js, Version: 5.5 or later
3. Copy connection string:
   ```
   mongodb+srv://ai_chat_user:<password>@ai-chat-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. Add to `.env.local`:
   ```bash
   MONGODB_URL=mongodb+srv://ai_chat_user:YOUR_PASSWORD@ai-chat-cluster.xxxxx.mongodb.net/
   DATABASE_NAME=ai_chat_app
   ```

### 5. Create Database & Collection
The repository will auto-create the database and collection on first write. Indexes are created on initialization.

---

## Dependencies to Install

```bash
# Backend
yarn add mongodb

# Testing
yarn add -D mongodb-memory-server
yarn add -D msw@latest
```

---

## Implementation Timeline (Revised)

**Phase 1: Backend** (Days 1-5)
- Days 1-3: Backend infrastructure (MongoDB client, repository, mapper, DI updates)
- Days 4-5: Backend API routes (list, get, delete)

**Phase 2: Frontend** (Days 6-10)
- Days 6-7: Frontend data layer (services, query hooks, mutations)
- Days 8-9: Frontend UI components (sidebar, list, items)
- Day 10: Integration polish

**Phase 3: Testing** (Days 11-13)
- Day 11: Backend tests (unit + integration)
- Day 12: Frontend tests (hooks, components, integration)
- Day 13: Bug fixes and test coverage

**Phase 4: Polish** (Day 14-15)
- Day 14: Manual testing, responsive behavior verification
- Day 15: Documentation, cleanup, final review

**Total**: 12-15 days (~2 weeks)

---

## Validation Process

### Phase 1: Automated Tests (CI/CD)
1. Run backend unit tests (mocked MongoDB)
2. Run backend integration tests (mongodb-memory-server)
3. Run frontend unit tests (MSW)
4. Verify coverage meets targets (80%+)

### Phase 2: E2E Validation (Playwright)
1. Execute 15 critical scenarios
2. Test on 3 viewports (mobile, tablet, desktop)
3. Verify all acceptance criteria
4. Document pass/fail status

### Phase 3: Manual Validation (Fran)
1. Conversation flow (5 min): Create, load, delete
2. Responsive design (5 min): Resize across breakpoints
3. Error states (3 min): Disconnect internet, kill MongoDB
4. Performance (2 min): Rapid switching with 50+ conversations

**Total Manual Testing Time**: ~15 minutes

### Phase 4: Validation Report
1. Map acceptance criteria to test results
2. Document any deviations
3. Provide actionable feedback
4. Update session context

---

## Documentation Reference

All detailed documentation is located in `.claude/doc/chat_history/`:

1. **backend.md** (200+ lines) - MongoDB repository architecture
2. **backend-testing-strategy.md** (400+ lines) - Backend test patterns
3. **frontend-data-architecture.md** (500+ lines) - React Query integration
4. **frontend-testing-strategy.md** (450+ lines) - Frontend test patterns
5. **sidebar-ui-design.md** (600+ lines) - UI/UX specifications
6. **acceptance-criteria.md** (900+ lines) - 75+ acceptance criteria
7. **validation-checklist.md** (100+ lines) - Quick validation guide

**Total Documentation**: ~3,000+ lines, 30,000+ words

---

## ✅ Decisions from Fran (Answered 2025-10-08)

1. **MongoDB Atlas**: ✅ Already have cluster configured - will provide connection string
2. **Testing Priority**: ✅ Features first, then comprehensive testing phase
3. **Health Check Endpoint**: ✅ Defer to Phase 2 - focus on core features
4. **Logging**: ✅ Console.log is fine for MVP
5. **Data Migration**: ✅ Fresh start - no existing data to migrate
6. **Pagination UI**: ✅ Don't implement yet - 100 conversations enough for MVP
7. **Real-time Updates**: ✅ Manual refresh - defer to future enhancement
8. **E2E Tests**: ✅ Skip E2E tests (Playwright) - unit + integration tests only

---

## Success Metrics

**Primary**:
- ✅ Zero message loss: 100% of sent messages persisted
- ✅ Fast loading: P95 <2s for list, <1.5s for conversation
- ✅ High availability: Database uptime >99.5%

**UX**:
- ✅ Smooth animations: >55fps sidebar transitions
- ✅ Auto-recovery: 90% of transient errors recover automatically
- ✅ Data consistency: 100% correct message ordering

**Technical**:
- ✅ Test coverage: 80%+ statements (backend + frontend)
- ✅ No regressions: All existing tests pass
- ✅ Accessibility: WCAG 2.1 AA compliance

---

## Ready for Implementation ✅

Fran, this plan is **complete and ready for execution**. All architectural decisions have been made, all test strategies defined, and all edge cases documented.

**Next step**: Please review this plan and the 7 detailed documents. Once approved, we can begin Phase 1 implementation.

**Estimated completion**: 2-3 weeks with comprehensive testing.
