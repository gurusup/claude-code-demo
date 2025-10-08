# Test Scenario Mapping

**Purpose**: Map acceptance criteria to specific test scenarios for comprehensive coverage
**Created**: 2025-10-08

---

## Test Pyramid Strategy

```
              ╱ E2E Tests (Playwright) ╲
             ╱    ~10 critical paths    ╲
            ╱─────────────────────────────╲
           ╱   Integration Tests (Vitest) ╲
          ╱  ~30 scenarios with real DB    ╲
         ╱──────────────────────────────────╲
        ╱     Unit Tests (Vitest)            ╲
       ╱  ~100+ scenarios, all mocked        ╲
      ╱─────────────────────────────────────────╲
```

---

## Backend Unit Tests (Vitest + Mocks)

### Domain Layer: `Conversation` Entity

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-1.1.1 | `it('should auto-generate title from first user message')` | `src/domain/entities/Conversation.test.ts` |
| AC-1.1.3 | `it('should truncate title to 50 characters with ellipsis')` | `src/domain/entities/Conversation.test.ts` |
| AC-1.1.3 | `it('should use only first line for multi-line messages')` | `src/domain/entities/Conversation.test.ts` |
| AC-1.2.1 | `it('should transition to WAITING_FOR_RESPONSE when user message added')` | `src/domain/entities/Conversation.test.ts` |
| AC-1.2.2 | `it('should transition to ACTIVE when assistant message added')` | `src/domain/entities/Conversation.test.ts` |
| AC-1.3.2 | `it('should update updatedAt timestamp on status change')` | `src/domain/entities/Conversation.test.ts` |
| AC-5.5.2 | `it('should throw ConversationError at 1000 message limit')` | `src/domain/entities/Conversation.test.ts` |
| AC-8.2.1 | `it('should generate valid UUID v4 on creation')` | `src/domain/entities/Conversation.test.ts` |
| AC-8.3.2 | `it('should validate message sequence (user → assistant → user)')` | `src/domain/entities/Conversation.test.ts` |

**Total Domain Tests**: ~25 scenarios

---

### Infrastructure Layer: `MongoConversationRepository` (Mocked)

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-1.2.4 | `it('should retrieve messages ordered by timestamp ascending')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-1.3.1 | `it('should update only new messages, not modify existing')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-2.2.1 | `it('should limit results to 100 conversations')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-2.2.1 | `it('should sort by updatedAt descending')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-4.3.2 | `it('should filter by status=ACTIVE')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-4.3.3 | `it('should filter by status=ARCHIVED')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-8.2.3 | `it('should update existing conversation, not create duplicate')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |
| AC-8.4.3 | `it('should cascade delete all messages when conversation deleted')` | `src/infrastructure/repositories/MongoConversationRepository.unit.test.ts` |

**Total Repository Unit Tests**: ~30 scenarios (with mocked MongoDB client)

---

### Application Layer: Use Cases (Mocked Repositories)

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-1.1.1 | `it('should create new conversation with UUID and timestamps')` | `src/application/use-cases/ManageConversationUseCase.test.ts` |
| AC-1.1.2 | `it('should return conversation ID to caller')` | `src/application/use-cases/ManageConversationUseCase.test.ts` |
| AC-4.1.3 | `it('should not persist conversation until first message sent')` | `src/application/use-cases/SendMessageUseCase.test.ts` |
| AC-4.2.3 | `it('should delete conversation from repository')` | `src/application/use-cases/DeleteConversationUseCase.test.ts` |
| AC-5.3.1 | `it('should throw error when conversation not found')` | `src/application/use-cases/ManageConversationUseCase.test.ts` |
| AC-8.1.1 | `it('should persist message before returning success')` | `src/application/use-cases/SendMessageUseCase.test.ts` |

**Total Use Case Tests**: ~20 scenarios

---

## Backend Integration Tests (Vitest + mongodb-memory-server)

### MongoDB Repository (Real Database)

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-1.3.3 | `it('should handle concurrent updates from multiple connections')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |
| AC-6.3.1 | `it('should query 100 conversations in under 500ms')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |
| AC-6.3.2 | `it('should retrieve 1000 messages in under 800ms')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |
| AC-8.2.2 | `it('should allow concurrent creation with different UUIDs')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |
| AC-8.4.1 | `it('should save conversation and message atomically')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |
| AC-8.4.2 | `it('should update updatedAt atomically with message insert')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |
| AC-8.4.3 | `it('should cascade delete messages with conversation')` | `src/infrastructure/repositories/MongoConversationRepository.integration.test.ts` |

**Total Integration Tests**: ~15 scenarios (tests run against real MongoDB instance)

---

## Frontend Unit Tests (React Testing Library + Vitest)

### Hooks: `useConversation`

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-1.1.2 | `it('should store conversationId in localStorage')` | `app/features/conversation/hooks/useConversation.test.tsx` |
| AC-3.1.2 | `it('should update localStorage when conversation loaded')` | `app/features/conversation/hooks/useConversation.test.tsx` |
| AC-4.1.2 | `it('should clear chat and generate new ID on startNewConversation')` | `app/features/conversation/hooks/useConversation.test.tsx` |

### Hooks: `useConversationList`

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-2.2.1 | `it('should fetch 50-100 recent conversations')` | `app/features/conversation/hooks/useConversationList.test.tsx` |
| AC-2.4.1 | `it('should show loading state while fetching')` | `app/features/conversation/hooks/useConversationList.test.tsx` |
| AC-2.5.1 | `it('should show error state on MongoDB failure')` | `app/features/conversation/hooks/useConversationList.test.tsx` |
| AC-4.3.4 | `it('should persist filter selection to localStorage')` | `app/features/conversation/hooks/useConversationList.test.tsx` |

### Components: `ConversationSidebar`

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-2.1.2 | `it('should toggle sidebar open/closed on hamburger click')` | `app/features/conversation/components/ConversationSidebar.test.tsx` |
| AC-2.2.3 | `it('should highlight active conversation with blue border')` | `app/features/conversation/components/ConversationSidebar.test.tsx` |
| AC-2.3.1 | `it('should show empty state when no conversations')` | `app/features/conversation/components/ConversationSidebar.test.tsx` |
| AC-3.1.1 | `it('should load conversation messages on click')` | `app/features/conversation/components/ConversationSidebar.test.tsx` |
| AC-4.2.2 | `it('should show delete confirmation dialog')` | `app/features/conversation/components/ConversationSidebar.test.tsx` |

**Total Frontend Unit Tests**: ~30 scenarios

---

## End-to-End Tests (Playwright)

### Critical Path: First Time User

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-1.1.1 | `test('should auto-save first conversation to MongoDB')` | `tests/e2e/chat-history.spec.ts` |
| AC-1.1.3 | `test('should generate title from first message')` | `tests/e2e/chat-history.spec.ts` |
| AC-2.2.1 | `test('should display conversation in sidebar after creation')` | `tests/e2e/chat-history.spec.ts` |

**Test Steps**:
1. Navigate to app (no conversations in DB)
2. Type "What is the weather in Tokyo?"
3. Send message
4. Wait for AI response
5. Open sidebar
6. Verify conversation appears with title "What is the weather in Tokyo?"
7. Refresh page
8. Verify conversation persists

---

### Critical Path: Load Existing Conversation

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-3.1.1 | `test('should load all messages when conversation clicked')` | `tests/e2e/chat-history.spec.ts` |
| AC-3.2.1 | `test('should preserve message formatting')` | `tests/e2e/chat-history.spec.ts` |
| AC-3.3.1 | `test('should scroll to bottom on load')` | `tests/e2e/chat-history.spec.ts` |
| AC-3.4.1 | `test('should highlight active conversation in sidebar')` | `tests/e2e/chat-history.spec.ts` |

**Test Steps**:
1. Create 5 conversations via API seeding
2. Open app
3. Open sidebar
4. Click 3rd conversation
5. Verify all messages load (check message count)
6. Verify scroll position at bottom
7. Verify conversation highlighted in sidebar

---

### Critical Path: Create New Conversation

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-4.1.2 | `test('should create new conversation and focus input')` | `tests/e2e/chat-history.spec.ts` |
| AC-4.1.3 | `test('should not persist until first message sent')` | `tests/e2e/chat-history.spec.ts` |

**Test Steps**:
1. Load app with existing conversation
2. Open sidebar
3. Click "New Chat" button
4. Verify chat area clears
5. Verify input focused
6. Verify sidebar closes (mobile) / stays open (desktop)
7. Verify new conversation NOT in sidebar yet
8. Send message
9. Verify conversation now appears in sidebar

---

### Critical Path: Delete Conversation

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-4.2.2 | `test('should show delete confirmation dialog')` | `tests/e2e/chat-history.spec.ts` |
| AC-4.2.3 | `test('should delete active conversation and create new one')` | `tests/e2e/chat-history.spec.ts` |
| AC-4.2.4 | `test('should delete inactive conversation without affecting active')` | `tests/e2e/chat-history.spec.ts` |
| AC-8.4.3 | `test('should hard delete from MongoDB (no recovery)')` | `tests/e2e/chat-history.spec.ts` |

**Test Steps**:
1. Create 3 conversations
2. Load conversation 2 (make it active)
3. Open sidebar
4. Hover over conversation 2
5. Click delete icon
6. Verify confirmation dialog appears
7. Click "Delete"
8. Verify conversation removed from sidebar
9. Verify new empty conversation created
10. Query MongoDB to confirm hard delete

---

### Critical Path: Filter by Status

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-4.3.2 | `test('should filter by Active status')` | `tests/e2e/chat-history.spec.ts` |
| AC-4.3.3 | `test('should filter by Archived status')` | `tests/e2e/chat-history.spec.ts` |
| AC-4.3.4 | `test('should persist filter to localStorage')` | `tests/e2e/chat-history.spec.ts` |

**Test Steps**:
1. Create 5 active + 3 archived conversations
2. Open sidebar
3. Verify 8 total conversations shown
4. Select "Active" filter
5. Verify only 5 conversations shown
6. Select "Archived" filter
7. Verify only 3 conversations shown
8. Refresh page
9. Verify filter persists (still showing archived)

---

### Responsive Design: Mobile

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-7.1.1 | `test('should overlay sidebar on mobile')` | `tests/e2e/responsive.spec.ts` |
| AC-7.1.2 | `test('should auto-close sidebar after selecting conversation')` | `tests/e2e/responsive.spec.ts` |
| AC-7.1.3 | `test('should close sidebar on swipe left')` | `tests/e2e/responsive.spec.ts` |

**Test Steps**:
1. Set viewport to 375x667 (iPhone SE)
2. Open sidebar
3. Verify sidebar width = 100vw - 48px
4. Verify backdrop visible
5. Click conversation
6. Verify sidebar auto-closes
7. Open sidebar again
8. Swipe left
9. Verify sidebar closes

---

### Responsive Design: Desktop

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-7.3.1 | `test('should default to collapsed on desktop')` | `tests/e2e/responsive.spec.ts` |
| AC-7.3.2 | `test('should resize chat area when sidebar expands')` | `tests/e2e/responsive.spec.ts` |
| AC-7.3.3 | `test('should persist sidebar state after refresh')` | `tests/e2e/responsive.spec.ts` |

**Test Steps**:
1. Set viewport to 1920x1080
2. Verify sidebar collapsed by default
3. Click hamburger menu
4. Verify sidebar expands to 320px with smooth animation
5. Verify chat area resizes to (1920 - 320)px
6. Refresh page
7. Verify sidebar state persists (remains expanded)

---

### Error Handling: MongoDB Connection Failure

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-5.1.1 | `test('should show connection error state in sidebar')` | `tests/e2e/error-handling.spec.ts` |
| AC-5.1.3 | `test('should auto-recover when connection restored')` | `tests/e2e/error-handling.spec.ts` |

**Test Steps**:
1. Kill MongoDB connection (mock network failure)
2. Open sidebar
3. Verify error state: "Unable to load conversations"
4. Verify "Retry" button shown
5. Restore connection
6. Click "Retry"
7. Verify conversations load successfully
8. Verify success toast appears

---

### Error Handling: Conversation Not Found

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-5.3.1 | `test('should redirect to new conversation when ID not found')` | `tests/e2e/error-handling.spec.ts` |

**Test Steps**:
1. Navigate to `/chat?conversationId=deleted-123`
2. Verify error message: "This conversation no longer exists"
3. Verify redirect to home
4. Verify new conversation created
5. Verify localStorage cleared

---

### Performance: Load Time

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-6.1.1 | `test('should load 100 conversations in under 2 seconds')` | `tests/e2e/performance.spec.ts` |
| AC-6.1.2 | `test('should load 50-message conversation in under 1.5 seconds')` | `tests/e2e/performance.spec.ts` |
| AC-6.2.1 | `test('should animate sidebar at 60fps')` | `tests/e2e/performance.spec.ts` |

**Test Steps**:
1. Seed 100 conversations via API
2. Measure time to open sidebar
3. Assert load time < 2000ms
4. Click conversation with 50 messages
5. Measure time to load messages
6. Assert load time < 1500ms
7. Measure sidebar animation FPS
8. Assert >= 55fps

---

### Data Integrity: No Message Loss

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-8.1.1 | `test('should persist message before API returns 200')` | `tests/e2e/data-integrity.spec.ts` |
| AC-8.1.2 | `test('should save partial response on stream interruption')` | `tests/e2e/data-integrity.spec.ts` |

**Test Steps**:
1. Send message with network monitoring enabled
2. Intercept API response
3. Query MongoDB before API returns
4. Verify message already persisted
5. Interrupt streaming mid-response
6. Query MongoDB
7. Verify partial response saved

---

### Data Integrity: No Duplicates

| AC ID | Test Scenario | File Location |
|-------|---------------|---------------|
| AC-8.2.2 | `test('should create unique conversations in multiple tabs')` | `tests/e2e/data-integrity.spec.ts` |

**Test Steps**:
1. Open app in 2 browser tabs
2. Click "New Chat" in both tabs simultaneously
3. Send message in tab 1
4. Send message in tab 2
5. Query MongoDB
6. Verify 2 conversations with different UUIDs
7. Verify no duplicate messages

---

## Test Coverage Summary

| Layer | Unit Tests | Integration Tests | E2E Tests | Total |
|-------|-----------|-------------------|-----------|-------|
| Domain | 25 | - | - | 25 |
| Infrastructure | 30 | 15 | - | 45 |
| Application | 20 | - | - | 20 |
| Frontend | 30 | - | - | 30 |
| E2E | - | - | 15 | 15 |
| **Total** | **105** | **15** | **15** | **135** |

---

## Test Execution Order

1. **Unit Tests** (fastest, run on every save)
   - Domain entities (Conversation, Message)
   - Repository (mocked MongoDB)
   - Use cases (mocked repositories)
   - Frontend hooks (mocked API)

2. **Integration Tests** (slower, run before commit)
   - Repository with mongodb-memory-server
   - Full CRUD lifecycle

3. **E2E Tests** (slowest, run in CI/CD)
   - Critical paths (5 scenarios)
   - Responsive design (2 scenarios)
   - Error handling (2 scenarios)
   - Performance (1 scenario)
   - Data integrity (2 scenarios)

---

## Playwright Test Files Structure

```
tests/
  e2e/
    chat-history.spec.ts         # Critical paths (5 tests)
    responsive.spec.ts            # Mobile/tablet/desktop (3 tests)
    error-handling.spec.ts        # Error scenarios (3 tests)
    performance.spec.ts           # Load time benchmarks (1 test)
    data-integrity.spec.ts        # No loss, no duplicates (3 tests)
  fixtures/
    conversations.ts              # Test data builders
    mongodb.ts                    # MongoDB test utilities
  helpers/
    sidebar.ts                    # Sidebar interaction helpers
    assertions.ts                 # Custom assertions
```

---

**Next Steps**:
1. Implement backend unit tests (start with domain)
2. Implement MongoDB repository with integration tests
3. Implement frontend unit tests for hooks/components
4. Write Playwright E2E tests for critical paths
5. Run full test suite and achieve coverage targets

---

**Document Version**: 1.0
**Created By**: QA Criteria Validator Agent
**Date**: 2025-10-08
