# MongoDB Repository Testing Strategy - Hexagonal Architecture

## Document Information
**Feature**: Chat History Persistence with MongoDB
**Created**: 2025-10-08
**Author**: backend-test-architect
**Target Audience**: Fran & Implementation Team
**Architecture**: Hexagonal (Ports & Adapters) with Next.js

---

## Table of Contents
1. [Testing Philosophy](#testing-philosophy)
2. [Unit Testing MongoDB Repository](#unit-testing-mongodb-repository)
3. [Integration Testing](#integration-testing)
4. [Use Case Testing](#use-case-testing)
5. [API Route Testing](#api-route-testing)
6. [Test Data Management](#test-data-management)
7. [CI/CD Considerations](#cicd-considerations)
8. [Recommended Test Structure](#recommended-test-structure)
9. [Tools & Dependencies](#tools--dependencies)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Testing Philosophy

### Core Principles for Hexagonal Architecture Testing

1. **Test Pyramid Adherence**: 70% unit tests, 20% integration tests, 10% E2E tests
2. **Layer Isolation**: Each layer should be testable in complete isolation
3. **Mock at Boundaries**: Mock external dependencies (MongoDB, OpenAI) at adapter boundaries
4. **Domain Purity**: Domain layer tests have ZERO infrastructure dependencies
5. **Fast Feedback**: Unit tests must run in milliseconds, integration tests in seconds
6. **Test Behavior, Not Implementation**: Focus on contracts and behavior, not internal implementation details

### Your Specific Hexagonal Architecture

```
Domain Layer (Pure Business Logic)
    ↑ No dependencies on infrastructure
Application Layer (Use Cases)
    ↑ Depends on domain + repository interfaces (ports)
Infrastructure Layer (Adapters)
    ↑ Implements repository interfaces
Web Layer (Next.js API Routes)
    ↑ Thin controllers delegating to use cases
```

**Testing Strategy**: Test each layer independently with mocked dependencies from outer layers.

---

## 1. Unit Testing MongoDB Repository

### 1.1 Testing Strategy

**Goal**: Test the MongoDB repository adapter in complete isolation without actual database connections.

### 1.2 Approach: Dual Testing Strategy

#### Strategy A: Pure Unit Tests with MongoDB Client Mocking

**When to Use**:
- CI/CD pipelines (fast, no external dependencies)
- Testing error scenarios (connection failures, timeouts)
- Testing data mapping logic
- Quick developer feedback loop

**How to Mock MongoDB Client**:

```typescript
// Use Vitest's vi.mock() to mock mongodb client
import { vi } from 'vitest';

// Mock the entire mongodb module
vi.mock('mongodb', () => ({
  MongoClient: vi.fn(() => ({
    connect: vi.fn(),
    db: vi.fn(() => ({
      collection: vi.fn(() => ({
        findOne: vi.fn(),
        insertOne: vi.fn(),
        updateOne: vi.fn(),
        deleteOne: vi.fn(),
        find: vi.fn(() => ({
          toArray: vi.fn(),
          skip: vi.fn(),
          limit: vi.fn(),
          sort: vi.fn(),
        })),
        countDocuments: vi.fn(),
      })),
    })),
    close: vi.fn(),
  })),
  ObjectId: vi.fn(),
}));
```

**What to Test with Mocks**:
1. **Entity-to-Document Mapping**: Verify `Conversation.toObject()` → MongoDB document conversion
2. **Document-to-Entity Restoration**: Verify MongoDB document → `Conversation.restore()` conversion
3. **Query Construction**: Verify correct filters, pagination, sorting parameters
4. **Error Translation**: MongoDB errors → Domain exceptions (e.g., `ConversationError`)
5. **Connection Lifecycle**: Verify `connect()`, `close()`, connection pooling behavior

**Example Test Structure**:

```typescript
describe('MongoConversationRepository - Unit Tests (Mocked Client)', () => {
  let repository: MongoConversationRepository;
  let mockCollection: any;

  beforeEach(() => {
    // Setup mocked MongoDB client and collection
    mockCollection = createMockCollection();
    repository = new MongoConversationRepository(mockMongoConfig);
  });

  describe('save()', () => {
    it('should insert new conversation document with correct structure', async () => {
      const conversation = Conversation.create();
      await repository.save(conversation);

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: conversation.getId(),
          messages: expect.any(Array),
          status: 'active',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should update existing conversation using replaceOne', async () => {
      const existingConversation = Conversation.create('existing-id');
      mockCollection.findOne.mockResolvedValue({ _id: 'existing-id' });

      await repository.save(existingConversation);

      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { _id: 'existing-id' },
        expect.any(Object)
      );
    });
  });

  describe('findById()', () => {
    it('should restore Conversation entity from MongoDB document', async () => {
      const mockDocument = {
        _id: 'conv-123',
        messages: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Test Conversation',
      };

      mockCollection.findOne.mockResolvedValue(mockDocument);

      const conversation = await repository.findById('conv-123');

      expect(conversation).toBeInstanceOf(Conversation);
      expect(conversation?.getId()).toBe('conv-123');
      expect(conversation?.getTitle()).toBe('Test Conversation');
    });

    it('should return null when conversation not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const conversation = await repository.findById('non-existent');

      expect(conversation).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw ConversationError when MongoDB connection fails', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Connection timeout'));

      await expect(repository.findById('conv-123')).rejects.toThrow(
        'Failed to retrieve conversation'
      );
    });

    it('should handle duplicate key errors gracefully', async () => {
      const duplicateError = new Error('E11000 duplicate key error');
      mockCollection.insertOne.mockRejectedValue(duplicateError);

      const conversation = Conversation.create('duplicate-id');

      await expect(repository.save(conversation)).rejects.toThrow(
        'Conversation already exists'
      );
    });
  });

  describe('Complex Entity Restoration', () => {
    it('should restore conversation with messages, tool invocations, and metadata', async () => {
      const mockDocument = {
        _id: 'conv-complex',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            toolInvocations: [],
            metadata: {},
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi there',
            toolInvocations: [
              {
                callId: 'call-1',
                toolName: 'weather',
                args: { location: 'NYC' },
                status: 'completed',
                result: { temp: 72 },
              },
            ],
            metadata: {},
          },
        ],
        status: 'active',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        title: 'Weather Chat',
      };

      mockCollection.findOne.mockResolvedValue(mockDocument);

      const conversation = await repository.findById('conv-complex');

      expect(conversation?.getMessageCount()).toBe(2);
      expect(conversation?.getLastAssistantMessage()?.hasToolInvocations()).toBe(true);
    });
  });
});
```

#### Strategy B: Integration Tests with mongodb-memory-server

**When to Use**:
- Verifying actual MongoDB query behavior
- Testing complex queries (aggregations, indexes)
- Testing transaction behavior (if needed)
- Validating schema constraints
- Pre-deployment verification

**Setup**:

```bash
yarn add -D mongodb-memory-server
```

**Example Integration Test**:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

describe('MongoConversationRepository - Integration Tests (In-Memory MongoDB)', () => {
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let repository: MongoConversationRepository;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Connect real MongoDB client to in-memory server
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    // Create repository with real connection
    repository = new MongoConversationRepository({
      mongoUrl: uri,
      databaseName: 'test-db',
    });
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clean up test data between tests
    const db = mongoClient.db('test-db');
    await db.collection('conversations').deleteMany({});
  });

  it('should perform full CRUD lifecycle with real MongoDB', async () => {
    // CREATE
    const conversation = Conversation.create();
    conversation.setTitle('Integration Test Conversation');
    await repository.save(conversation);

    // READ
    const retrieved = await repository.findById(conversation.getId());
    expect(retrieved?.getTitle()).toBe('Integration Test Conversation');

    // UPDATE
    retrieved?.setTitle('Updated Title');
    await repository.save(retrieved!);

    const updated = await repository.findById(conversation.getId());
    expect(updated?.getTitle()).toBe('Updated Title');

    // DELETE
    await repository.delete(conversation.getId());
    const deleted = await repository.findById(conversation.getId());
    expect(deleted).toBeNull();
  });

  it('should handle pagination correctly with real data', async () => {
    // Insert 10 conversations
    const conversations = Array.from({ length: 10 }, (_, i) =>
      Conversation.create(`conv-${i}`)
    );

    for (const conv of conversations) {
      await repository.save(conv);
    }

    // Test pagination
    const page1 = await repository.findAll({ limit: 5, offset: 0 });
    expect(page1).toHaveLength(5);

    const page2 = await repository.findAll({ limit: 5, offset: 5 });
    expect(page2).toHaveLength(5);

    // Verify no duplicates between pages
    const page1Ids = page1.map(c => c.getId());
    const page2Ids = page2.map(c => c.getId());
    expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
  });

  it('should correctly sort by updatedAt (newest first)', async () => {
    const conv1 = Conversation.create('conv-1');
    await repository.save(conv1);

    // Wait to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const conv2 = Conversation.create('conv-2');
    await repository.save(conv2);

    const all = await repository.findAll();

    expect(all[0].getId()).toBe('conv-2'); // Newest first
    expect(all[1].getId()).toBe('conv-1');
  });

  it('should handle concurrent writes correctly', async () => {
    const conversation = Conversation.create('concurrent-test');

    // Simulate concurrent updates
    const promises = Array.from({ length: 5 }, async (_, i) => {
      const conv = await repository.findById('concurrent-test');
      conv?.setTitle(`Update ${i}`);
      if (conv) await repository.save(conv);
    });

    await Promise.all(promises);

    const final = await repository.findById('concurrent-test');
    expect(final).toBeTruthy();
    expect(final?.getTitle()).toMatch(/Update \d/);
  });
});
```

### 1.3 Recommended Approach: Both Strategies

**Recommendation**: Use BOTH mocked unit tests AND mongodb-memory-server integration tests.

| Aspect | Mocked Unit Tests | mongodb-memory-server Integration |
|--------|------------------|----------------------------------|
| **Speed** | Milliseconds | Seconds |
| **CI/CD** | Every commit | Pre-merge, nightly builds |
| **Coverage** | Error scenarios, edge cases | Real query behavior |
| **Dependencies** | None | In-memory MongoDB |
| **Maintenance** | High (mocks can drift) | Low (real MongoDB API) |

**File Organization**:
```
src/infrastructure/repositories/
  MongoConversationRepository.ts
  __tests__/
    MongoConversationRepository.unit.test.ts    # Mocked MongoDB client
    MongoConversationRepository.integration.test.ts  # mongodb-memory-server
```

---

## 2. Integration Testing

### 2.1 Integration Test Scenarios

**Definition**: Tests that verify interactions between multiple layers (e.g., repository + database, use case + repository).

### 2.2 Testing with Real MongoDB Atlas Connection

**When to Use**: Pre-production verification, smoke tests in staging environment.

**Setup**:

```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    testTimeout: 30000, // Allow longer timeout for network calls
    setupFiles: ['./tests/setup/integration.setup.ts'],
  },
});
```

**Environment Configuration**:

```typescript
// tests/setup/integration.setup.ts
import { beforeAll, afterAll } from 'vitest';

let testMongoClient: MongoClient;

beforeAll(async () => {
  const mongoUrl = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017';
  testMongoClient = new MongoClient(mongoUrl);
  await testMongoClient.connect();

  // Create test database
  const db = testMongoClient.db('test-chat-history');
  await db.createCollection('conversations');
});

afterAll(async () => {
  // Clean up test database
  const db = testMongoClient.db('test-chat-history');
  await db.dropDatabase();
  await testMongoClient.close();
});
```

### 2.3 Test Data Setup and Teardown

**Best Practices**:

1. **Isolated Test Database**: Use separate database for tests (e.g., `test-chat-history`)
2. **Transaction Rollback**: If MongoDB supports transactions, use them for test isolation
3. **Cleanup Between Tests**: Use `afterEach()` to delete test data
4. **Deterministic Data**: Use fixed timestamps, UUIDs for predictable test results

**Example Setup**:

```typescript
describe('Repository Integration Tests', () => {
  let repository: MongoConversationRepository;
  let testDbClient: MongoClient;

  beforeEach(async () => {
    // Create fresh repository instance
    repository = new MongoConversationRepository({
      mongoUrl: process.env.TEST_MONGODB_URL!,
      databaseName: 'test-chat-history',
    });

    // Clean up previous test data
    const db = testDbClient.db('test-chat-history');
    await db.collection('conversations').deleteMany({});
  });

  afterEach(async () => {
    // Ensure cleanup even if test fails
    const db = testDbClient.db('test-chat-history');
    await db.collection('conversations').deleteMany({});
  });
});
```

### 2.4 Testing Concurrent Operations

**Critical Test Case**: MongoDB repository must handle concurrent saves correctly.

```typescript
it('should handle concurrent conversation updates without data loss', async () => {
  const conversationId = 'concurrent-test';
  const conversation = Conversation.create(conversationId);
  await repository.save(conversation);

  // Simulate 10 concurrent updates
  const updatePromises = Array.from({ length: 10 }, async (_, i) => {
    const conv = await repository.findById(conversationId);

    // Simulate user adding a message
    const { Message } = require('@/domain/entities/Message');
    const { MessageRole } = require('@/domain/value-objects/MessageRole');
    const { MessageContent } = require('@/domain/value-objects/MessageContent');

    const message = Message.create(
      MessageRole.from('user'),
      MessageContent.from(`Message ${i}`)
    );

    conv?.addMessage(message);
    await repository.save(conv!);
  });

  await Promise.all(updatePromises);

  // Verify final state
  const final = await repository.findById(conversationId);

  // Due to race conditions, we might not have all 10 messages
  // This is expected behavior - we're testing that no corruption occurs
  expect(final?.getMessageCount()).toBeGreaterThan(0);
  expect(final?.getMessageCount()).toBeLessThanOrEqual(10);

  // All messages should be valid
  const messages = final?.getMessages() || [];
  messages.forEach(msg => {
    expect(msg.getContent().getValue()).toMatch(/Message \d/);
  });
});
```

**Note**: This test verifies that concurrent writes don't corrupt data, but may result in lost updates. If you need true concurrent write handling, implement optimistic locking with version fields.

---

## 3. Use Case Testing

### 3.1 Testing Philosophy

**Goal**: Test use case orchestration logic WITHOUT dependencies on actual database.

**Key Principle**: Mock the repository, test the business logic.

### 3.2 Mocking Repository in Use Case Tests

**Approach**: Use Vitest's `vi.fn()` to create repository mocks.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManageConversationUseCase } from '@/application/use-cases/ManageConversationUseCase';
import { IConversationRepository } from '@/domain/repositories/IConversationRepository';
import { Conversation } from '@/domain/entities/Conversation';

describe('ManageConversationUseCase - Unit Tests', () => {
  let useCase: ManageConversationUseCase;
  let mockRepository: jest.Mocked<IConversationRepository>;

  beforeEach(() => {
    // Create mock repository implementing the interface
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
      findActive: vi.fn(),
      archiveOlderThan: vi.fn(),
    };

    // Inject mocked repository into use case
    useCase = new ManageConversationUseCase(mockRepository);
  });

  describe('createConversation()', () => {
    it('should create new conversation and save to repository', async () => {
      const conversation = await useCase.createConversation('Test Title');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          getTitle: expect.any(Function),
        })
      );

      expect(conversation.getTitle()).toBe('Test Title');
    });

    it('should create conversation without title if not provided', async () => {
      const conversation = await useCase.createConversation();

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(conversation.getTitle()).toBeUndefined();
    });
  });

  describe('getConversation()', () => {
    it('should retrieve conversation from repository', async () => {
      const mockConversation = Conversation.create('test-id');
      mockRepository.findById.mockResolvedValue(mockConversation);

      const result = await useCase.getConversation('test-id');

      expect(mockRepository.findById).toHaveBeenCalledWith('test-id');
      expect(result).toBe(mockConversation);
    });

    it('should return null when conversation not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await useCase.getConversation('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('archiveConversation()', () => {
    it('should archive conversation and save to repository', async () => {
      const conversation = Conversation.create('test-id');
      mockRepository.findById.mockResolvedValue(conversation);

      await useCase.archiveConversation('test-id');

      expect(mockRepository.findById).toHaveBeenCalledWith('test-id');
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isArchived: expect.any(Function),
        })
      );
    });

    it('should throw error when conversation not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(useCase.archiveConversation('non-existent')).rejects.toThrow(
        'Conversation not found'
      );
    });
  });

  describe('listConversations()', () => {
    it('should retrieve paginated conversations from repository', async () => {
      const mockConversations = [
        Conversation.create('conv-1'),
        Conversation.create('conv-2'),
      ];

      mockRepository.findAll.mockResolvedValue(mockConversations);

      const result = await useCase.listConversations({
        limit: 50,
        offset: 0,
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        status: 'active',
      });

      expect(result).toHaveLength(2);
    });

    it('should include archived conversations when requested', async () => {
      const mockConversations = [
        Conversation.create('conv-1'),
        Conversation.create('conv-2'),
      ];
      mockConversations[1].archive();

      mockRepository.findAll.mockResolvedValue(mockConversations);

      await useCase.listConversations({
        includeArchived: true,
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        status: undefined, // No status filter when includeArchived
      });
    });
  });
});
```

### 3.3 Testing ListConversationsUseCase with Pagination

**New Use Case to Test**:

```typescript
describe('ListConversationsUseCase', () => {
  let useCase: ListConversationsUseCase;
  let mockRepository: jest.Mocked<IConversationRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    useCase = new ListConversationsUseCase(mockRepository);
  });

  it('should apply default pagination (50 conversations)', async () => {
    mockRepository.findAll.mockResolvedValue([]);

    await useCase.execute({});

    expect(mockRepository.findAll).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      status: 'active',
    });
  });

  it('should respect custom pagination limits', async () => {
    await useCase.execute({ limit: 100, offset: 50 });

    expect(mockRepository.findAll).toHaveBeenCalledWith({
      limit: 100,
      offset: 50,
      status: 'active',
    });
  });

  it('should map conversations to DTOs correctly', async () => {
    const mockConversations = [
      Conversation.restore(
        'conv-1',
        [],
        ConversationStatus.ACTIVE,
        new Date('2025-01-01'),
        new Date('2025-01-02'),
        'Test Conversation'
      ),
    ];

    mockRepository.findAll.mockResolvedValue(mockConversations);

    const result = await useCase.execute({});

    expect(result[0]).toMatchObject({
      id: 'conv-1',
      title: 'Test Conversation',
      messageCount: 0,
      status: 'active',
    });
  });
});
```

### 3.4 Testing Error Propagation

**Critical Test**: Verify that repository errors propagate correctly through use cases.

```typescript
describe('Error Propagation from Repository to Use Case', () => {
  it('should propagate repository connection errors', async () => {
    mockRepository.findById.mockRejectedValue(
      new Error('MongoDB connection timeout')
    );

    await expect(useCase.getConversation('test-id')).rejects.toThrow(
      'MongoDB connection timeout'
    );
  });

  it('should wrap repository errors in domain exceptions', async () => {
    mockRepository.save.mockRejectedValue(
      new Error('Duplicate key error')
    );

    const conversation = Conversation.create();

    await expect(useCase.createConversation()).rejects.toThrow(
      ConversationError
    );
  });
});
```

---

## 4. API Route Testing

### 4.1 Testing Next.js API Routes

**Goal**: Test API routes as thin controllers delegating to use cases.

**Approach**: Mock use cases, test HTTP request/response handling.

### 4.2 Testing `/api/conversations/list` Endpoint

**Example Test Structure**:

```typescript
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/conversations/list/route';
import { DependencyContainer } from '@/infrastructure/config/DependencyContainer';

// Mock DependencyContainer
vi.mock('@/infrastructure/config/DependencyContainer');

describe('GET /api/conversations/list', () => {
  let mockListConversationsUseCase: any;

  beforeEach(() => {
    mockListConversationsUseCase = {
      execute: vi.fn(),
    };

    // Mock DependencyContainer to return mocked use case
    vi.mocked(DependencyContainer.getInstance).mockReturnValue({
      getListConversationsUseCase: () => mockListConversationsUseCase,
    } as any);
  });

  it('should return 200 with conversation list', async () => {
    const mockConversations = [
      { id: 'conv-1', title: 'Conversation 1', messageCount: 5 },
      { id: 'conv-2', title: 'Conversation 2', messageCount: 3 },
    ];

    mockListConversationsUseCase.execute.mockResolvedValue(mockConversations);

    const request = new NextRequest('http://localhost:3000/api/conversations/list');
    const response = await GET(request);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual(mockConversations);
  });

  it('should handle pagination query parameters', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/conversations/list?limit=100&offset=50'
    );

    mockListConversationsUseCase.execute.mockResolvedValue([]);

    await GET(request);

    expect(mockListConversationsUseCase.execute).toHaveBeenCalledWith({
      limit: 100,
      offset: 50,
    });
  });

  it('should return 500 when use case throws error', async () => {
    mockListConversationsUseCase.execute.mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/conversations/list');
    const response = await GET(request);

    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });

  it('should return 503 when database is unavailable', async () => {
    mockListConversationsUseCase.execute.mockRejectedValue(
      new Error('MONGODB_URL not configured')
    );

    const request = new NextRequest('http://localhost:3000/api/conversations/list');
    const response = await GET(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('not configured'),
    });
  });
});
```

### 4.3 Testing Database State in API Tests

**Recommendation**: Do NOT use real database in API route tests. Mock at the use case layer.

**Why**:
- API route tests should be fast (unit tests)
- Testing database connection is the job of integration tests
- Mocking use cases allows testing HTTP-specific concerns (headers, status codes, error handling)

**What to Test in API Routes**:
1. HTTP status codes (200, 400, 500, 503)
2. Request parsing (query params, body, headers)
3. Response formatting (JSON structure, headers)
4. Error translation (domain errors → HTTP errors)
5. Authentication/Authorization (when implemented)

---

## 5. Test Data Management

### 5.1 Fixtures vs Factories

**Recommendation**: Use **Test Data Builders (Factories)** instead of static fixtures.

**Why**:
- Flexibility: Customize test data per test case
- Maintainability: Single source of truth for test data creation
- Readability: Expressive builder pattern

### 5.2 Test Data Builder Pattern

**Example Implementation**:

```typescript
// tests/builders/ConversationBuilder.ts
import { Conversation, ConversationStatus } from '@/domain/entities/Conversation';
import { Message } from '@/domain/entities/Message';
import { MessageRole } from '@/domain/value-objects/MessageRole';
import { MessageContent } from '@/domain/value-objects/MessageContent';

export class ConversationBuilder {
  private id?: string;
  private messages: Message[] = [];
  private status: ConversationStatus = ConversationStatus.ACTIVE;
  private title?: string;
  private createdAt: Date = new Date('2025-01-01T00:00:00Z');
  private updatedAt: Date = new Date('2025-01-01T00:00:00Z');

  static aConversation(): ConversationBuilder {
    return new ConversationBuilder();
  }

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withStatus(status: ConversationStatus): this {
    this.status = status;
    return this;
  }

  withMessages(count: number): this {
    for (let i = 0; i < count; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      const message = Message.create(
        MessageRole.from(role),
        MessageContent.from(`Message ${i}`)
      );
      this.messages.push(message);
    }
    return this;
  }

  withUserMessage(content: string): this {
    this.messages.push(
      Message.create(
        MessageRole.from('user'),
        MessageContent.from(content)
      )
    );
    return this;
  }

  withAssistantMessage(content: string): this {
    this.messages.push(
      Message.create(
        MessageRole.from('assistant'),
        MessageContent.from(content)
      )
    );
    return this;
  }

  withCreatedAt(date: Date): this {
    this.createdAt = date;
    return this;
  }

  withUpdatedAt(date: Date): this {
    this.updatedAt = date;
    return this;
  }

  archived(): this {
    this.status = ConversationStatus.ARCHIVED;
    return this;
  }

  build(): Conversation {
    if (this.messages.length === 0 && !this.id) {
      return Conversation.create();
    }

    return Conversation.restore(
      this.id || 'test-conversation',
      this.messages,
      this.status,
      this.createdAt,
      this.updatedAt,
      this.title
    );
  }
}
```

**Usage in Tests**:

```typescript
import { ConversationBuilder } from '@/tests/builders/ConversationBuilder';

describe('Repository Tests with Builder', () => {
  it('should save conversation with messages', async () => {
    const conversation = ConversationBuilder.aConversation()
      .withId('conv-123')
      .withTitle('Test Conversation')
      .withMessages(5)
      .build();

    await repository.save(conversation);

    const retrieved = await repository.findById('conv-123');
    expect(retrieved?.getMessageCount()).toBe(5);
  });

  it('should filter archived conversations', async () => {
    const activeConv = ConversationBuilder.aConversation()
      .withId('active')
      .build();

    const archivedConv = ConversationBuilder.aConversation()
      .withId('archived')
      .archived()
      .build();

    await repository.save(activeConv);
    await repository.save(archivedConv);

    const active = await repository.findAll({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].getId()).toBe('active');
  });
});
```

### 5.3 Seeding Test Database

**For Integration Tests**: Create seed data scripts.

```typescript
// tests/seeds/conversationSeeds.ts
export async function seedConversations(
  repository: IConversationRepository,
  count: number = 10
): Promise<Conversation[]> {
  const conversations = Array.from({ length: count }, (_, i) =>
    ConversationBuilder.aConversation()
      .withId(`seed-conv-${i}`)
      .withTitle(`Seeded Conversation ${i}`)
      .withMessages(Math.floor(Math.random() * 10))
      .build()
  );

  for (const conv of conversations) {
    await repository.save(conv);
  }

  return conversations;
}
```

**Usage**:

```typescript
describe('Pagination Integration Tests', () => {
  beforeEach(async () => {
    await seedConversations(repository, 100);
  });

  it('should paginate through 100 conversations', async () => {
    const page1 = await repository.findAll({ limit: 50, offset: 0 });
    const page2 = await repository.findAll({ limit: 50, offset: 50 });

    expect(page1).toHaveLength(50);
    expect(page2).toHaveLength(50);
  });
});
```

### 5.4 Cleaning Up Between Tests

**Best Practices**:

```typescript
describe('Repository Tests', () => {
  afterEach(async () => {
    // Option 1: Delete all test data
    const db = mongoClient.db('test-chat-history');
    await db.collection('conversations').deleteMany({});
  });

  // Option 2: Track created IDs and delete only those
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await repository.delete(id);
    }
    createdIds.length = 0;
  });
});
```

---

## 6. CI/CD Considerations

### 6.1 Testing Strategy for CI/CD Pipelines

**Recommended Approach**: Multi-stage testing pipeline.

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run unit tests (mocked MongoDB)
        run: yarn test --run
        env:
          NODE_ENV: test

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand({ping: 1})'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run integration tests
        run: yarn test:integration
        env:
          NODE_ENV: test
          TEST_MONGODB_URL: mongodb://localhost:27017

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run E2E tests against test cluster
        run: yarn test:e2e
        env:
          MONGODB_URL: ${{ secrets.TEST_MONGODB_ATLAS_URL }}
          DATABASE_NAME: test-chat-history
```

### 6.2 MongoDB Atlas Test Cluster vs Local MongoDB

**Recommendation**: Use both depending on test type.

| Test Type | Environment | Why |
|-----------|------------|-----|
| Unit Tests | No MongoDB (mocked) | Fast, no external dependencies |
| Integration Tests (CI) | Local MongoDB (Docker service) | Faster than Atlas, no secrets needed |
| Integration Tests (Local Dev) | mongodb-memory-server | Zero configuration, instant setup |
| E2E Tests | MongoDB Atlas Test Cluster | Real production environment |
| Smoke Tests (Pre-deploy) | MongoDB Atlas Staging | Verify against actual deployment |

### 6.3 Environment Variable Management

**Setup**:

```typescript
// tests/config/testEnv.ts
export const getTestMongoUrl = (): string => {
  // Priority:
  // 1. Environment variable (CI/CD)
  // 2. Local MongoDB (Docker)
  // 3. mongodb-memory-server (auto-start)
  return (
    process.env.TEST_MONGODB_URL ||
    process.env.MONGODB_URL ||
    'mongodb://localhost:27017'
  );
};

export const getTestDatabaseName = (): string => {
  return process.env.TEST_DATABASE_NAME || 'test-chat-history';
};
```

**Usage**:

```typescript
describe('Integration Tests', () => {
  beforeAll(async () => {
    const mongoUrl = getTestMongoUrl();
    const dbName = getTestDatabaseName();

    repository = new MongoConversationRepository({
      mongoUrl,
      databaseName: dbName,
    });
  });
});
```

### 6.4 Performance Considerations

**Best Practices**:

1. **Parallelize Unit Tests**: Run all unit tests in parallel (Vitest default)
2. **Sequential Integration Tests**: Run integration tests sequentially to avoid database conflicts
3. **Cleanup Strategy**: Delete only necessary data, not entire collections
4. **Connection Pooling**: Reuse MongoDB connections across tests
5. **Test Timeout**: Set reasonable timeouts (5s for unit, 30s for integration)

**Vitest Configuration**:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Unit tests - parallel
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});

// vitest.integration.config.ts
export default defineConfig({
  test: {
    // Integration tests - sequential
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

---

## 7. Recommended Test Structure

### 7.1 Directory Organization

```
src/
  domain/
    entities/
      Conversation.ts
      __tests__/
        Conversation.test.ts
    repositories/
      IConversationRepository.ts

  application/
    use-cases/
      ManageConversationUseCase.ts
      ListConversationsUseCase.ts
      __tests__/
        ManageConversationUseCase.test.ts
        ListConversationsUseCase.test.ts

  infrastructure/
    repositories/
      MongoConversationRepository.ts
      InMemoryConversationRepository.ts
      __tests__/
        MongoConversationRepository.unit.test.ts
        MongoConversationRepository.integration.test.ts
        InMemoryConversationRepository.test.ts

app/
  api/
    conversations/
      route.ts
      list/
        route.ts
      __tests__/
        conversations.test.ts
        list.test.ts

tests/
  builders/
    ConversationBuilder.ts
    MessageBuilder.ts
  fixtures/
    conversationFixtures.ts
  seeds/
    conversationSeeds.ts
  setup/
    integration.setup.ts
    testEnv.ts
  helpers/
    mockRepository.ts
    mockMongoClient.ts
```

### 7.2 Naming Conventions

| File Type | Naming Convention | Example |
|-----------|------------------|---------|
| Unit Tests | `*.test.ts` | `Conversation.test.ts` |
| Integration Tests | `*.integration.test.ts` | `MongoConversationRepository.integration.test.ts` |
| E2E Tests | `*.e2e.test.ts` | `conversationFlow.e2e.test.ts` |
| Test Builders | `*Builder.ts` | `ConversationBuilder.ts` |
| Test Fixtures | `*Fixtures.ts` | `conversationFixtures.ts` |
| Mock Helpers | `mock*.ts` | `mockRepository.ts` |

### 7.3 Test Coverage Goals

| Layer | Coverage Target | Priority |
|-------|----------------|----------|
| Domain Entities | 95%+ | Critical |
| Domain Value Objects | 95%+ | Critical |
| Application Use Cases | 90%+ | High |
| Infrastructure Repositories | 80%+ | High |
| API Routes | 70%+ | Medium |
| Mappers/DTOs | 80%+ | Medium |

**Note**: Coverage is a metric, not a goal. Focus on meaningful tests that verify behavior, not implementation details.

---

## 8. Tools & Dependencies

### 8.1 Required Dependencies

```json
{
  "devDependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^5.0.4",
    "@vitest/coverage-v8": "^3.2.4",
    "@vitest/ui": "^3.2.4",
    "jsdom": "^27.0.0",
    "mongodb-memory-server": "^10.1.2",  // NEW
    "vite": "^7.1.9",
    "vitest": "^3.2.4"
  }
}
```

### 8.2 Installation

```bash
yarn add -D mongodb-memory-server
```

### 8.3 Vitest Configuration Files

**vitest.config.ts** (Unit Tests):
```typescript
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    include: ['**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/*.e2e.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.test.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

**vitest.integration.config.ts** (Integration Tests):
```typescript
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    include: ['**/*.integration.test.ts'],
    testTimeout: 30000,
    setupFiles: ['./tests/setup/integration.setup.ts'],
  },
});
```

### 8.4 Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --config vitest.config.ts",
    "test:integration": "vitest --config vitest.integration.config.ts",
    "test:e2e": "vitest --config vitest.e2e.config.ts",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch"
  }
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal**: Set up testing infrastructure and test MongoDB repository.

1. **Install Dependencies**
   ```bash
   yarn add -D mongodb-memory-server
   ```

2. **Create Test Builders**
   - `ConversationBuilder.ts`
   - `MessageBuilder.ts`

3. **Implement MongoDB Repository**
   - `MongoConversationRepository.ts`
   - Implement all `IConversationRepository` methods

4. **Write Unit Tests (Mocked MongoDB)**
   - `MongoConversationRepository.unit.test.ts`
   - Test all CRUD operations
   - Test error scenarios
   - Test entity restoration

5. **Write Integration Tests (mongodb-memory-server)**
   - `MongoConversationRepository.integration.test.ts`
   - Test pagination
   - Test concurrent operations
   - Test real MongoDB queries

**Success Criteria**:
- All repository methods implemented
- 80%+ test coverage on repository
- All tests passing

### Phase 2: Use Case Testing (Week 2)

**Goal**: Test application layer with mocked repositories.

1. **Implement New Use Cases**
   - `ListConversationsUseCase.ts`

2. **Write Use Case Tests**
   - `ManageConversationUseCase.test.ts`
   - `ListConversationsUseCase.test.ts`
   - Mock repository, test orchestration logic

3. **Test Error Propagation**
   - Verify repository errors propagate correctly
   - Test domain exception handling

**Success Criteria**:
- All use cases tested with mocked repository
- 90%+ coverage on use cases
- Error scenarios covered

### Phase 3: API Route Testing (Week 2-3)

**Goal**: Test web layer with mocked use cases.

1. **Implement API Routes**
   - `GET /api/conversations/list`
   - `DELETE /api/conversations/[id]`

2. **Write API Route Tests**
   - Mock use cases
   - Test HTTP status codes
   - Test request parsing
   - Test error responses

**Success Criteria**:
- All API routes tested
- 70%+ coverage on API routes
- HTTP error handling verified

### Phase 4: CI/CD Integration (Week 3)

**Goal**: Integrate tests into CI/CD pipeline.

1. **Configure GitHub Actions**
   - Unit tests (every commit)
   - Integration tests (pre-merge)
   - E2E tests (staging deployment)

2. **Setup Test MongoDB Atlas Cluster**
   - Create dedicated test database
   - Configure connection string as secret

3. **Performance Optimization**
   - Parallelize unit tests
   - Optimize cleanup strategies
   - Monitor test execution time

**Success Criteria**:
- CI/CD pipeline running all tests
- Tests complete in < 5 minutes
- No flaky tests

### Phase 5: Maintenance & Monitoring (Ongoing)

**Goal**: Maintain high test quality over time.

1. **Code Coverage Monitoring**
   - Integrate Codecov or similar
   - Set coverage thresholds
   - Block PRs below threshold

2. **Test Performance Monitoring**
   - Track test execution time
   - Identify slow tests
   - Optimize or parallelize

3. **Test Quality Reviews**
   - Review test failures
   - Update tests when APIs change
   - Refactor brittle tests

**Success Criteria**:
- Maintaining 80%+ overall coverage
- Zero flaky tests
- Test suite execution < 5 minutes

---

## 10. Key Recommendations Summary

### 10.1 Critical Decisions

1. **Use BOTH Mocked Unit Tests AND Integration Tests**
   - Mocked: Fast feedback, CI/CD
   - Integration: Real behavior verification

2. **Use mongodb-memory-server for Local Integration Tests**
   - Zero configuration
   - Fast setup
   - Isolated test environment

3. **Use Test Data Builders Instead of Fixtures**
   - More flexible
   - Easier to maintain
   - Expressive test code

4. **Mock Repositories in Use Case Tests**
   - Test business logic in isolation
   - Fast test execution
   - No database dependencies

5. **Mock Use Cases in API Route Tests**
   - Test HTTP concerns separately
   - Fast test execution
   - Clear separation of concerns

### 10.2 Testing Anti-Patterns to Avoid

❌ **Don't**: Use real MongoDB in unit tests
✅ **Do**: Mock MongoDB client or use mongodb-memory-server

❌ **Don't**: Use real database in use case tests
✅ **Do**: Mock repository interface

❌ **Don't**: Use static fixtures for test data
✅ **Do**: Use test data builders

❌ **Don't**: Test implementation details
✅ **Do**: Test behavior and contracts

❌ **Don't**: Share test database between tests
✅ **Do**: Clean up between tests or use transactions

❌ **Don't**: Ignore test failures in CI/CD
✅ **Do**: Fail builds on test failures

❌ **Don't**: Skip error scenario tests
✅ **Do**: Comprehensively test error handling

### 10.3 Quick Reference

**Test Type** | **What to Test** | **What to Mock** | **Speed**
---|---|---|---
Domain Entity Unit Tests | Business rules, invariants | Nothing | Milliseconds
Repository Unit Tests | Data mapping, error translation | MongoDB client | Milliseconds
Repository Integration Tests | Real queries, pagination | Nothing | Seconds
Use Case Unit Tests | Orchestration logic | Repository | Milliseconds
API Route Tests | HTTP handling | Use cases | Milliseconds
E2E Tests | Full user flows | Nothing (real services) | Minutes

---

## Next Steps

1. **Review this strategy with Fran** - Get approval on approach
2. **Install mongodb-memory-server** - `yarn add -D mongodb-memory-server`
3. **Create test builders** - Start with `ConversationBuilder`
4. **Implement MongoDB repository** - Focus on `save()` and `findById()` first
5. **Write first tests** - Start with mocked unit tests
6. **Iterate** - Gradually add integration tests and use case tests

---

## Questions for Fran

Before implementation, please clarify:

1. **MongoDB Atlas Setup**: Do you already have a test database cluster, or should we create one?
2. **CI/CD Platform**: Are you using GitHub Actions, GitLab CI, or another platform?
3. **Test Coverage Goals**: Are you comfortable with 80% overall coverage, or do you want higher?
4. **Test Execution Time**: What's your acceptable test suite execution time (current target: < 5 minutes)?
5. **MongoDB Version**: Which MongoDB version are you targeting (e.g., 7.0, 6.0)?

---

**End of Testing Strategy Document**

This document will be continuously updated as we implement and discover new testing patterns specific to your hexagonal architecture.
