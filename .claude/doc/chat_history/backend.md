# MongoDB Repository Implementation - Architectural Guidance

## Executive Summary

This document provides comprehensive architectural guidance for implementing a MongoDB repository adapter for the conversation persistence layer. The implementation follows hexagonal architecture principles, maintaining clean separation between domain logic and infrastructure concerns.

**Key Decisions:**
- Use native MongoDB Node.js driver (NOT Mongoose)
- MongoDB Atlas cloud deployment
- Environment-based repository selection (MongoDB vs InMemory)
- Connection pooling with singleton client
- Robust error handling with graceful degradation
- Document schema optimized for query patterns

---

## 1. MongoDB Connection Management

### 1.1 Singleton Pattern with Connection Pooling

**Recommendation: Create a MongoDBClient singleton wrapper**

The MongoDB Node.js driver provides built-in connection pooling. You should implement a singleton wrapper that:

1. **Initializes once** on first access
2. **Reuses the connection pool** across all repository instances
3. **Provides health check** capabilities
4. **Handles graceful shutdown**

**Architecture Pattern:**

```
src/infrastructure/adapters/database/
  MongoDBClient.ts          # Singleton connection manager
  MongoDBHealthCheck.ts     # Health check implementation
  MongoDBConversationRepository.ts  # Repository implementation
  mappers/
    ConversationDocumentMapper.ts   # Entity <-> Document mapping
```

**Key Implementation Points:**

```typescript
// MongoDBClient.ts conceptual structure
class MongoDBClient {
  private static instance: MongoDBClient | null = null;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {} // Private constructor

  static async getInstance(): Promise<MongoDBClient> {
    if (!instance) {
      instance = new MongoDBClient();
      await instance.connect();
    }
    return instance;
  }

  async connect(): Promise<void> {
    // Connection with retry logic
    // Configuration from env variables
  }

  getDatabase(): Db {
    // Returns database instance
  }

  async disconnect(): Promise<void> {
    // Graceful shutdown
  }

  async healthCheck(): Promise<boolean> {
    // Ping database to verify connection
  }
}
```

**Connection Configuration:**

```typescript
// Recommended connection options
const mongoClientOptions = {
  maxPoolSize: 10,           // Max connections in pool
  minPoolSize: 2,            // Min connections maintained
  maxIdleTimeMS: 60000,      // Close idle connections after 60s
  serverSelectionTimeoutMS: 5000,  // Timeout for server selection
  socketTimeoutMS: 45000,    // Socket timeout
  retryWrites: true,         // Retry failed writes
  retryReads: true,          // Retry failed reads
};
```

### 1.2 Environment Variables

**Required Environment Variables:**

```bash
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=ai_chat_app
REPOSITORY_TYPE=mongodb  # or "inmemory"
```

**Validation Strategy:**

- Validate on application startup
- Throw descriptive errors if missing
- Provide clear fallback messaging

### 1.3 Reconnection Strategy

**Automatic Reconnection:**

The MongoDB driver handles reconnection automatically with `retryWrites` and `retryReads` options. However, you should implement:

1. **Initial Connection Retry**: Retry connection on startup (3-5 attempts with exponential backoff)
2. **Connection Event Monitoring**: Log connection events for observability
3. **Circuit Breaker Pattern** (optional): Temporarily fail fast if connection is repeatedly failing

**Event Monitoring Example:**

```typescript
client.on('serverHeartbeatFailed', (event) => {
  console.error('MongoDB heartbeat failed:', event);
});

client.on('serverHeartbeatSucceeded', (event) => {
  console.log('MongoDB heartbeat succeeded');
});

client.on('connectionPoolCleared', (event) => {
  console.warn('MongoDB connection pool cleared:', event);
});
```

### 1.4 Error Handling for Atlas Connection Failures

**Three-Tier Error Handling Strategy:**

**Tier 1: Initialization Errors (Startup)**
- If MongoDB connection fails on startup → Log warning and fallback to InMemory
- Application continues to function with transient storage
- Expose health check endpoint to monitor database status

**Tier 2: Runtime Errors (Repository Operations)**
- Wrap all database operations in try-catch
- Classify errors: Network, Authentication, Query, Document validation
- Return domain-specific errors (not MongoDB errors)

**Tier 3: Graceful Degradation**
- If MongoDB becomes unavailable during runtime:
  - Log error with full context
  - Optionally: Switch to InMemory repository (requires state migration - complex)
  - OR: Return error to application layer to handle

**Error Classification:**

```typescript
enum MongoDBErrorType {
  CONNECTION_FAILED = 'connection_failed',
  AUTHENTICATION_FAILED = 'authentication_failed',
  NETWORK_TIMEOUT = 'network_timeout',
  QUERY_FAILED = 'query_failed',
  DOCUMENT_VALIDATION_FAILED = 'document_validation_failed',
  UNKNOWN = 'unknown'
}

// Map MongoDB errors to domain errors
class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly type: MongoDBErrorType,
    public readonly originalError?: Error
  ) {
    super(message);
  }
}
```

---

## 2. Document Schema Design

### 2.1 MongoDB Collection Structure

**Collection Name:** `conversations`

**Document Schema:**

```typescript
interface ConversationDocument {
  _id: string;                    // Conversation.id (use custom UUID, not ObjectId)
  title?: string;                 // Auto-generated from first message
  status: string;                 // 'active' | 'waiting_for_response' | 'completed' | 'archived'
  messages: MessageDocument[];    // Embedded messages array
  metadata: Record<string, any>;  // Flexible metadata storage
  createdAt: Date;                // Date object (NOT ISO string)
  updatedAt: Date;                // Date object (NOT ISO string)

  // Optional fields for future features
  userId?: string;                // For multi-user support
  tags?: string[];                // For categorization
}

interface MessageDocument {
  id: string;                     // Message.id
  role: string;                   // 'user' | 'assistant' | 'system' | 'tool'
  content: string;                // Message content
  timestamp: Date;                // Message timestamp
  toolInvocations?: ToolInvocationDocument[];  // Optional tool calls
  attachments?: AttachmentDocument[];          // Optional attachments
  metadata?: Record<string, any>;  // Optional metadata
}

interface ToolInvocationDocument {
  callId: string;
  toolName: string;
  args: Record<string, any>;
  state: string;                  // 'pending' | 'executing' | 'completed' | 'failed'
  result?: any;
  error?: string;
}

interface AttachmentDocument {
  name: string;
  contentType: string;
  url: string;
}
```

**Why Embedded Messages (Not References)?**

✅ **Pros:**
- Single query to fetch entire conversation
- Atomic updates for conversation + messages
- Better performance for read-heavy workload
- Simpler transaction management
- Matches aggregate root pattern (Conversation is the aggregate)

❌ **Cons:**
- Document size limit (16MB - unlikely to hit with 1000 message limit)
- Cannot query messages independently across conversations

**Decision:** Use embedded messages because Conversation is an aggregate root in DDD, and messages should never exist without their parent conversation.

### 2.2 Date Handling Strategy

**Recommendation: Use MongoDB Date objects (NOT ISO strings)**

**Rationale:**
1. Native MongoDB date queries (`$gte`, `$lte`, `$sort`)
2. Automatic timezone handling
3. Better index performance
4. Simpler query syntax

**Mapping Strategy:**

```typescript
// Entity -> Document (saving)
const document: ConversationDocument = {
  _id: conversation.getId(),
  createdAt: conversation.getCreatedAt(),  // Keep as Date
  updatedAt: conversation.getUpdatedAt(),  // Keep as Date
  // ...
};

// Document -> Entity (restoration)
const entity = Conversation.restore(
  document._id,
  messages,
  document.status as ConversationStatus,
  document.createdAt,  // MongoDB Date -> JS Date (automatic)
  document.updatedAt,  // MongoDB Date -> JS Date (automatic)
  document.title
);
```

**Important Notes:**
- MongoDB stores dates in UTC
- JavaScript Date objects handle timezone conversion automatically
- Always use `new Date()` for timestamps, never `Date.now()` (which returns number)

### 2.3 Index Strategy

**Recommended Indexes:**

```typescript
// In MongoDBConversationRepository initialization
async createIndexes() {
  const collection = this.getCollection();

  // Primary lookup by _id (automatic index, no need to create)

  // Index 1: Sort by updatedAt (for findAll queries)
  await collection.createIndex(
    { updatedAt: -1 },
    { name: 'idx_updatedAt_desc' }
  );

  // Index 2: Filter by status + sort by updatedAt (for findActive, findAll with status filter)
  await collection.createIndex(
    { status: 1, updatedAt: -1 },
    { name: 'idx_status_updatedAt' }
  );

  // Index 3: Optional - userId for multi-user support
  await collection.createIndex(
    { userId: 1, updatedAt: -1 },
    { name: 'idx_userId_updatedAt', sparse: true }
  );

  // Index 4: Compound index for archive operations
  await collection.createIndex(
    { status: 1, updatedAt: 1 },
    { name: 'idx_status_updatedAt_asc' }
  );
}
```

**Index Performance Notes:**

- **Don't over-index**: Each index slows down writes
- **MongoDB Atlas auto-suggests indexes**: Monitor in Performance Advisor
- **Consider covering indexes** for frequently queried fields
- **Use sparse indexes** for optional fields (like userId)

**Query Optimization Tips:**

1. Use `.explain()` to analyze query performance
2. Monitor slow queries in Atlas Performance Advisor
3. Use projection to exclude `messages` array when only metadata is needed
4. Consider TTL index if conversations auto-expire after X days

---

## 3. Repository Implementation Pattern

### 3.1 Mapper Pattern (Entity ↔ Document)

**Architectural Pattern: Dedicated Mapper Class**

Create a dedicated mapper to isolate serialization/deserialization logic:

```
src/infrastructure/adapters/database/mappers/
  ConversationDocumentMapper.ts
```

**Responsibilities:**

1. **`toDocument(entity: Conversation): ConversationDocument`**
   - Convert entity to MongoDB document
   - Handle nested entities (Message, ToolInvocation)
   - Extract metadata from Map to object

2. **`toEntity(document: ConversationDocument): Conversation`**
   - Restore entity from document
   - Reconstruct value objects (MessageRole, MessageContent, ToolName)
   - Handle missing optional fields
   - Validate document structure

**Implementation Strategy:**

```typescript
class ConversationDocumentMapper {
  static toDocument(conversation: Conversation): ConversationDocument {
    const conversationData = conversation.toObject();

    return {
      _id: conversationData.id,
      title: conversationData.title,
      status: conversationData.status,
      messages: conversationData.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),  // ISO string -> Date
        toolInvocations: msg.toolInvocations?.map(ti => ({
          callId: ti.callId,
          toolName: ti.toolName,
          args: ti.args,
          state: ti.state,
          result: ti.result,
          error: ti.error,
        })),
        attachments: msg.attachments?.map(att => ({
          name: att.name,
          contentType: att.contentType,
          url: att.url,
        })),
        metadata: msg.metadata,
      })),
      metadata: {}, // Extract from conversation metadata if needed
      createdAt: conversationData.createdAt,
      updatedAt: conversationData.updatedAt,
    };
  }

  static toEntity(document: ConversationDocument): Conversation {
    // Reconstruct Message entities
    const messages = document.messages.map(msgDoc => {
      const role = MessageRole.from(msgDoc.role);
      const content = MessageContent.from(msgDoc.content);

      // Reconstruct tool invocations
      const toolInvocations = (msgDoc.toolInvocations || []).map(tiDoc => {
        const invocation = ToolInvocation.create(
          tiDoc.callId,
          ToolName.from(tiDoc.toolName),
          tiDoc.args
        );

        // Restore state
        if (tiDoc.state === 'completed') {
          invocation.markAsExecuting();
          invocation.complete(tiDoc.result);
        } else if (tiDoc.state === 'failed') {
          invocation.markAsExecuting();
          invocation.fail(new Error(tiDoc.error || 'Unknown error'));
        } else if (tiDoc.state === 'executing') {
          invocation.markAsExecuting();
        }

        return invocation;
      });

      // Reconstruct message
      const message = Message.createWithId(
        msgDoc.id,
        role,
        content,
        [], // attachments - implement when needed
        toolInvocations
      );

      // Restore metadata
      if (msgDoc.metadata) {
        Object.entries(msgDoc.metadata).forEach(([key, value]) => {
          message.addMetadata(key, value);
        });
      }

      return message;
    });

    // Restore conversation entity
    return Conversation.restore(
      document._id,
      messages,
      document.status as ConversationStatus,
      document.createdAt,
      document.updatedAt,
      document.title
    );
  }
}
```

**Key Notes:**

1. **Rely on `Conversation.toObject()`**: The domain entity already provides serialization
2. **Handle Value Objects**: Must reconstruct MessageRole, MessageContent, ToolName using `.from()` methods
3. **Restore Tool Invocation State**: Must manually replay state transitions
4. **Defensive Programming**: Validate document structure before mapping (handle missing fields)
5. **Error Handling**: Wrap mapping in try-catch and throw descriptive errors

### 3.2 Entity Restoration Best Practices

**Critical: Use `Conversation.restore()` Static Factory Method**

The `Conversation` entity provides a `restore()` method specifically for rebuilding from persistence:

```typescript
static restore(
  id: string,
  messages: Message[],
  status: ConversationStatus,
  createdAt: Date,
  updatedAt: Date,
  title?: string
): Conversation
```

**Why This Matters:**

- Bypasses domain validation rules (e.g., "can't add message to archived conversation")
- Preserves historical state
- Sets readonly properties (createdAt, updatedAt)

**Common Mistakes to Avoid:**

❌ **WRONG**: `const conv = Conversation.create(); conv.addMessage(...)`
- This triggers validation rules
- Loses historical timestamps

✅ **CORRECT**: `Conversation.restore(id, messages, status, createdAt, updatedAt, title)`
- Directly restores state
- Preserves all historical data

### 3.3 Transaction Handling

**MongoDB Transaction Support: Optional for This Use Case**

**Current Architecture Analysis:**

- Each repository operation is atomic at the document level
- `save()` replaces entire conversation document (atomic)
- `delete()` removes single document (atomic)
- No cross-document operations

**Recommendation: Transactions NOT Required**

**Rationale:**

1. **Single document operations are atomic** in MongoDB
2. **Conversation is aggregate root** - all changes go through it
3. **No distributed transactions** needed (no cross-aggregate operations)
4. **Simpler implementation** without transaction overhead

**When Transactions Would Be Needed:**

- If you split messages into separate collection (don't do this)
- If you have cross-conversation operations (e.g., bulk archiving with audit log)
- If you implement saga patterns for distributed operations

**Exception: Optimistic Locking**

Consider adding optimistic locking for concurrent updates:

```typescript
interface ConversationDocument {
  _id: string;
  version: number;  // Increment on each update
  // ... other fields
}

// Update with version check
async save(conversation: Conversation): Promise<void> {
  const document = ConversationDocumentMapper.toDocument(conversation);
  const currentVersion = document.version || 0;

  const result = await collection.updateOne(
    { _id: document._id, version: currentVersion },
    { $set: { ...document, version: currentVersion + 1 } },
    { upsert: false }
  );

  if (result.matchedCount === 0) {
    throw new ConflictError('Conversation was modified by another process');
  }
}
```

**Decision: Skip optimistic locking for MVP** (implement if concurrency issues arise)

### 3.4 Pagination Best Practices for `findAll()`

**Requirement: Limit to 50-100 recent conversations**

**Recommended Implementation:**

```typescript
async findAll(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<Conversation[]> {
  const limit = options?.limit || 100;  // Default 100
  const offset = options?.offset || 0;

  const filter: any = {};
  if (options?.status) {
    filter.status = options.status;
  }

  const documents = await this.collection
    .find(filter)
    .sort({ updatedAt: -1 })  // Newest first
    .skip(offset)
    .limit(limit)
    .toArray();

  return documents.map(doc => ConversationDocumentMapper.toEntity(doc));
}
```

**Performance Optimizations:**

1. **Use Projection for List Views:**

```typescript
// When you only need metadata (not full messages array)
async findAllMetadata(options?: { limit?: number }): Promise<ConversationMetadata[]> {
  const documents = await this.collection
    .find({})
    .project({
      _id: 1,
      title: 1,
      status: 1,
      updatedAt: 1,
      createdAt: 1,
      messageCount: { $size: '$messages' }  // Compute message count
    })
    .sort({ updatedAt: -1 })
    .limit(options?.limit || 100)
    .toArray();

  return documents; // Much smaller payload
}
```

2. **Cursor-Based Pagination** (for infinite scroll):

```typescript
async findAllCursor(options?: {
  afterId?: string;
  limit?: number;
}): Promise<Conversation[]> {
  const filter: any = {};

  if (options?.afterId) {
    // Find conversations with updatedAt older than the reference conversation
    const refDoc = await this.collection.findOne({ _id: options.afterId });
    if (refDoc) {
      filter.updatedAt = { $lt: refDoc.updatedAt };
    }
  }

  const documents = await this.collection
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(options?.limit || 100)
    .toArray();

  return documents.map(doc => ConversationDocumentMapper.toEntity(doc));
}
```

**Key Notes:**

- **Default limit of 100** prevents unbounded queries
- **Always sort by updatedAt descending** for "most recent" behavior
- **Use skip + limit** for offset pagination (simpler for MVP)
- **Consider projection** if frontend only needs metadata
- **Index on updatedAt** is critical for performance

---

## 4. Dependency Injection Updates

### 4.1 Environment-Based Repository Selection

**Update `DependencyContainer.ts`:**

```typescript
// Add to ContainerConfig interface
export interface ContainerConfig {
  openaiApiKey?: string;
  repositoryType?: 'mongodb' | 'inmemory';  // NEW
  mongodbUrl?: string;                      // NEW
  databaseName?: string;                    // NEW
  enableLogging?: boolean;
}

// Update initializeAdapters() method
private async initializeAdapters(): Promise<void> {
  // ... existing AI provider initialization

  // Initialize repository based on config
  const repositoryType = this.config.repositoryType
    || process.env.REPOSITORY_TYPE
    || 'inmemory';

  if (repositoryType === 'mongodb') {
    try {
      const mongodbUrl = this.config.mongodbUrl || process.env.MONGODB_URL;
      const databaseName = this.config.databaseName || process.env.DATABASE_NAME;

      if (!mongodbUrl || !databaseName) {
        throw new Error('MongoDB configuration missing (MONGODB_URL or DATABASE_NAME)');
      }

      // Import dynamically to avoid loading MongoDB driver if not needed
      const { MongoDBConversationRepository } = await import(
        '../repositories/MongoDBConversationRepository'
      );

      this.conversationRepository = await MongoDBConversationRepository.create(
        mongodbUrl,
        databaseName
      );

      console.log('✓ MongoDB repository initialized');
    } catch (error) {
      console.error('MongoDB repository initialization failed:', error);
      console.warn('⚠ Falling back to InMemory repository');
      this.conversationRepository = new InMemoryConversationRepository();
    }
  } else {
    console.log('✓ InMemory repository initialized');
    this.conversationRepository = new InMemoryConversationRepository();
  }

  // ... rest of initialization
}
```

**Key Design Decisions:**

1. **Graceful Fallback**: If MongoDB fails, fall back to InMemory (with clear warning logs)
2. **Dynamic Import**: Only load MongoDB driver if needed (reduces bundle size for InMemory mode)
3. **Environment Priority**: Config > Env variables > Default (inmemory)
4. **Async Initialization**: `initializeAdapters()` must become async

### 4.2 Async Container Initialization

**Challenge: Constructor Cannot Be Async**

**Solution: Factory Method Pattern**

```typescript
export class DependencyContainer {
  private static instance: DependencyContainer | null = null;

  private constructor(private config: ContainerConfig) {
    // Synchronous initialization only
  }

  private async initialize(): Promise<void> {
    await this.initializeAdapters();
    this.initializeUseCases();
  }

  // NEW: Async factory method
  static async create(config: ContainerConfig): Promise<DependencyContainer> {
    if (!DependencyContainer.instance) {
      const container = new DependencyContainer(config);
      await container.initialize();
      DependencyContainer.instance = container;
    }
    return DependencyContainer.instance;
  }

  // DEPRECATED: Keep for backward compatibility but log warning
  static getInstance(config?: ContainerConfig): DependencyContainer {
    console.warn('getInstance() is deprecated. Use create() instead.');
    if (!DependencyContainer.instance) {
      throw new Error('Container not initialized. Call create() first.');
    }
    return DependencyContainer.instance;
  }
}
```

**Update API Route:**

```typescript
// app/api/conversations/route.ts
import { DependencyContainer } from '@/infrastructure/config/DependencyContainer';

// Initialize container once on module load
let containerPromise: Promise<DependencyContainer> | null = null;

async function getContainer(): Promise<DependencyContainer> {
  if (!containerPromise) {
    containerPromise = DependencyContainer.create({
      openaiApiKey: process.env.OPENAI_API_KEY,
      repositoryType: (process.env.REPOSITORY_TYPE as any) || 'inmemory',
      mongodbUrl: process.env.MONGODB_URL,
      databaseName: process.env.DATABASE_NAME,
      enableLogging: process.env.NODE_ENV === 'development',
    });
  }
  return containerPromise;
}

export async function POST(request: Request) {
  const container = await getContainer();
  const useCase = container.getManageConversationUseCase();
  // ... rest of handler
}
```

### 4.3 Health Check Integration

**Add Health Check Endpoint:**

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { getContainer } from '@/lib/container'; // Centralized container getter

export async function GET() {
  try {
    const container = await getContainer();
    const health = await container.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: (error as Error).message,
    }, { status: 503 });
  }
}
```

**Update `DependencyContainer.healthCheck()`:**

```typescript
async healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  services: Record<string, boolean | number>;
  errors: string[];
}> {
  const errors: string[] = [];
  const services: Record<string, boolean | number> = {};

  // ... existing health checks (AI provider, weather service)

  // Add MongoDB health check
  try {
    if (this.conversationRepository instanceof MongoDBConversationRepository) {
      services.repositoryType = 'mongodb';
      services.mongodbConnected = await this.conversationRepository.healthCheck();
    } else {
      services.repositoryType = 'inmemory';
      services.mongodbConnected = 'N/A';
    }

    const count = await this.conversationRepository.count();
    services.repository = true;
    services.conversationCount = count;
  } catch (error) {
    services.repository = false;
    errors.push(`Repository: ${(error as Error).message}`);
  }

  // ... rest of health check
}
```

**MongoDB Health Check in Repository:**

```typescript
// In MongoDBConversationRepository
async healthCheck(): Promise<boolean> {
  try {
    const client = await MongoDBClient.getInstance();
    await client.ping();  // Simple ping command
    return true;
  } catch (error) {
    console.error('MongoDB health check failed:', error);
    return false;
  }
}
```

---

## 5. Edge Cases & Error Handling

### 5.1 Connection Failures

**Scenario 1: Initial Connection Failure (Startup)**

```typescript
// In MongoDBClient.connect()
async connect(): Promise<void> {
  const maxRetries = 3;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      this.client = new MongoClient(this.url, this.options);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);

      console.log(`✓ Connected to MongoDB (attempt ${attempt}/${maxRetries})`);
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        await this.sleep(retryDelayMs * attempt);  // Exponential backoff
      } else {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }
    }
  }
}
```

**Scenario 2: Runtime Connection Loss**

The MongoDB driver handles this automatically with:
- `retryWrites: true` - Retries failed writes once
- `retryReads: true` - Retries failed reads once
- Automatic reconnection on network errors

**Your responsibility**: Log errors and surface to application layer.

```typescript
async findById(id: string): Promise<Conversation | null> {
  try {
    const document = await this.collection.findOne({ _id: id });
    if (!document) return null;

    return ConversationDocumentMapper.toEntity(document);
  } catch (error) {
    if (error.name === 'MongoNetworkError') {
      console.error('MongoDB network error:', error);
      throw new RepositoryError(
        'Database connection lost',
        MongoDBErrorType.NETWORK_TIMEOUT,
        error
      );
    } else if (error.name === 'MongoServerError') {
      console.error('MongoDB server error:', error);
      throw new RepositoryError(
        'Database server error',
        MongoDBErrorType.QUERY_FAILED,
        error
      );
    } else {
      console.error('Unexpected error finding conversation:', error);
      throw new RepositoryError(
        'Failed to retrieve conversation',
        MongoDBErrorType.UNKNOWN,
        error
      );
    }
  }
}
```

### 5.2 Fallback to InMemory Repository

**Challenge: Runtime Fallback is Complex**

If MongoDB fails during runtime, switching to InMemory repository would require:
1. Migrating all in-memory data to MongoDB
2. Or accepting data loss
3. Complex state management

**Recommendation: Don't Implement Runtime Fallback**

Instead:
- **Startup Fallback Only**: If MongoDB fails on startup, use InMemory from the beginning
- **Clear User Communication**: If MongoDB fails during runtime, return error to user
- **Monitoring & Alerts**: Set up alerts for MongoDB errors (use health check endpoint)

**Alternative: Graceful Error Responses**

```typescript
// In API route handler
try {
  const conversation = await useCase.execute(conversationId);
  return NextResponse.json(conversation);
} catch (error) {
  if (error instanceof RepositoryError) {
    return NextResponse.json({
      error: 'Database temporarily unavailable. Please try again.',
      code: error.type,
    }, { status: 503 });
  }

  throw error;  // Re-throw unexpected errors
}
```

### 5.3 Document Not Found Scenarios

**Scenario: `findById()` returns null**

This is normal behavior, not an error. Use cases should handle:

```typescript
// In ManageConversationUseCase
async execute(conversationId?: string): Promise<Conversation> {
  if (conversationId) {
    const existing = await this.repository.findById(conversationId);
    if (existing) {
      return existing;
    }

    // Document not found - create new conversation with this ID
    console.warn(`Conversation ${conversationId} not found, creating new`);
  }

  const newConversation = Conversation.create(conversationId);
  await this.repository.save(newConversation);
  return newConversation;
}
```

**Key Point**: Repository returns `null` for not found (not throwing error).

### 5.4 Concurrent Updates

**Problem**: Two processes update the same conversation simultaneously.

**Solutions:**

**Option 1: Optimistic Locking (Recommended for Future)**

```typescript
interface ConversationDocument {
  _id: string;
  version: number;  // Increment on each save
  // ... other fields
}

async save(conversation: Conversation): Promise<void> {
  const document = ConversationDocumentMapper.toDocument(conversation);
  const currentVersion = await this.getCurrentVersion(document._id);

  const result = await this.collection.updateOne(
    { _id: document._id, version: currentVersion },
    {
      $set: { ...document },
      $inc: { version: 1 }
    },
    { upsert: false }
  );

  if (result.matchedCount === 0) {
    throw new ConcurrentModificationError(
      `Conversation ${document._id} was modified by another process`
    );
  }
}
```

**Option 2: Last-Write-Wins (Current Behavior)**

Accept that the last write overwrites previous changes. This is acceptable for MVP since:
- Conversation operations are typically sequential (user sends message, waits for response)
- No multi-user editing of same conversation
- If conflicts occur, they're rare and recoverable

**Recommendation for MVP**: Use last-write-wins. Add optimistic locking if concurrency issues arise.

### 5.5 Database Migration Strategy

**Phase 1: Zero Downtime Migration (MongoDB Introduction)**

Since you're starting with InMemory:

1. Deploy with `REPOSITORY_TYPE=inmemory` (current state)
2. Set up MongoDB Atlas cluster
3. Deploy with `REPOSITORY_TYPE=mongodb` (new deployments use MongoDB)
4. No data migration needed (InMemory was transient anyway)

**Phase 2: Schema Evolution (Future)**

When you need to change the document schema:

**Option A: Runtime Migration (Small Changes)**

```typescript
// In ConversationDocumentMapper.toEntity()
static toEntity(document: any): Conversation {
  // Handle missing fields (migration)
  const messages = document.messages || [];
  const status = document.status || ConversationStatus.ACTIVE;
  const createdAt = document.createdAt || new Date(document._id);  // Fallback

  // ... rest of mapping
}
```

**Option B: Migration Script (Breaking Changes)**

```typescript
// scripts/migrate-conversations.ts
import { MongoClient } from 'mongodb';

async function migrate() {
  const client = new MongoClient(process.env.MONGODB_URL!);
  await client.connect();

  const db = client.db(process.env.DATABASE_NAME!);
  const collection = db.collection('conversations');

  // Example: Add version field to all documents
  const result = await collection.updateMany(
    { version: { $exists: false } },
    { $set: { version: 1 } }
  );

  console.log(`Migrated ${result.modifiedCount} documents`);

  await client.close();
}

migrate().catch(console.error);
```

**Option C: Versioned Collections (Major Rewrites)**

```typescript
// Create new collection: conversations_v2
// Gradually migrate data
// Update repository to read from both collections
// Switch over when complete
```

**Recommendation**: Start with runtime migration (Option A) for MVP.

---

## 6. Implementation Checklist

### 6.1 Files to Create

```
src/infrastructure/adapters/database/
  ├── MongoDBClient.ts                    # Singleton connection manager
  ├── MongoDBConversationRepository.ts    # Repository implementation
  └── mappers/
      └── ConversationDocumentMapper.ts   # Entity <-> Document mapping

src/infrastructure/adapters/database/types/
  └── ConversationDocument.ts             # TypeScript interfaces for documents

src/infrastructure/config/
  └── (Update) DependencyContainer.ts     # Add MongoDB initialization
```

### 6.2 Files to Modify

```
src/infrastructure/config/DependencyContainer.ts
  - Make initializeAdapters() async
  - Add repository selection logic
  - Update healthCheck() to include MongoDB status

.env.example (CREATE)
  - Add MONGODB_URL example
  - Add DATABASE_NAME example
  - Add REPOSITORY_TYPE example

package.json (UPDATE)
  - Verify mongodb driver is installed (should already be from @vercel/kv)
  - If not: yarn add mongodb
```

### 6.3 Environment Variables to Add

```bash
# MongoDB Configuration
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=ai_chat_app

# Repository Selection (optional, defaults to 'inmemory')
REPOSITORY_TYPE=mongodb  # or 'inmemory'
```

### 6.4 MongoDB Atlas Setup Steps

1. **Create Atlas Account**: https://www.mongodb.com/cloud/atlas/register
2. **Create Free Tier Cluster**:
   - Select M0 Free Tier
   - Choose cloud provider & region (e.g., AWS us-east-1)
   - Cluster name: `ai-chat-cluster`
3. **Create Database User**:
   - Username: `ai_chat_user`
   - Password: Generate strong password
   - Role: `readWrite` on specific database
4. **Configure Network Access**:
   - Add IP: `0.0.0.0/0` (allow all) for development
   - For production: Add specific IPs or use Vercel IP ranges
5. **Get Connection String**:
   - Click "Connect" > "Connect your application"
   - Copy connection string
   - Replace `<password>` with actual password
6. **Create Database**:
   - Database name: `ai_chat_app`
   - Collection name: `conversations`

### 6.5 Development Workflow

**Step 1: Install MongoDB Driver (if not already installed)**

```bash
yarn add mongodb
```

**Step 2: Create MongoDBClient**

Implement singleton with connection pooling and health check.

**Step 3: Create ConversationDocumentMapper**

Implement bidirectional mapping with full Message/ToolInvocation support.

**Step 4: Create MongoDBConversationRepository**

Implement all IConversationRepository methods using mapper.

**Step 5: Update DependencyContainer**

Add async initialization and repository selection logic.

**Step 6: Test with InMemory First**

Deploy with `REPOSITORY_TYPE=inmemory` to ensure no regressions.

**Step 7: Test with MongoDB**

Set up Atlas cluster, configure env variables, test with `REPOSITORY_TYPE=mongodb`.

**Step 8: Add Health Check Endpoint**

Create `/api/health` route to monitor MongoDB connection.

---

## 7. Testing Recommendations

### 7.1 Unit Tests (Repository)

**Test File**: `src/infrastructure/adapters/database/MongoDBConversationRepository.test.ts`

**Key Test Cases:**

1. **Connection Management**
   - ✓ Connects successfully with valid credentials
   - ✓ Throws error with invalid credentials
   - ✓ Reuses existing connection on subsequent calls
   - ✓ Handles connection pool exhaustion

2. **CRUD Operations**
   - ✓ `save()` creates new conversation document
   - ✓ `save()` updates existing conversation document
   - ✓ `findById()` retrieves existing conversation
   - ✓ `findById()` returns null for non-existent ID
   - ✓ `delete()` removes conversation
   - ✓ `findAll()` returns limited results sorted by updatedAt

3. **Mapper Tests**
   - ✓ `toDocument()` correctly serializes entity
   - ✓ `toEntity()` correctly deserializes document
   - ✓ Round-trip: entity -> document -> entity preserves data
   - ✓ Handles nested messages with tool invocations
   - ✓ Handles empty messages array
   - ✓ Handles missing optional fields

4. **Error Handling**
   - ✓ Network errors are properly caught and wrapped
   - ✓ Query errors are properly classified
   - ✓ Malformed documents throw descriptive errors

**Testing Strategy:**

Use **MongoDB Memory Server** for integration tests:

```bash
yarn add -D mongodb-memory-server
```

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('MongoDBConversationRepository', () => {
  let mongoServer: MongoMemoryServer;
  let repository: MongoDBConversationRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    repository = await MongoDBConversationRepository.create(uri, 'test_db');
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  it('should save and retrieve a conversation', async () => {
    const conversation = Conversation.create();
    await repository.save(conversation);

    const retrieved = await repository.findById(conversation.getId());
    expect(retrieved).not.toBeNull();
    expect(retrieved?.getId()).toBe(conversation.getId());
  });
});
```

### 7.2 Integration Tests

**Test File**: `src/infrastructure/config/DependencyContainer.test.ts`

**Key Test Cases:**

1. ✓ Container initializes with InMemory repository when `REPOSITORY_TYPE=inmemory`
2. ✓ Container initializes with MongoDB repository when `REPOSITORY_TYPE=mongodb`
3. ✓ Container falls back to InMemory when MongoDB connection fails
4. ✓ Health check reflects correct repository type

### 7.3 End-to-End Tests

**Test File**: `app/api/conversations/route.test.ts`

**Key Test Cases:**

1. ✓ POST creates conversation and persists to MongoDB
2. ✓ GET retrieves persisted conversation
3. ✓ Conversation survives server restart (when using MongoDB)
4. ✓ Returns error when MongoDB is unavailable

---

## 8. Performance Considerations

### 8.1 Query Optimization

**Current Performance Profile:**

| Operation | Query Pattern | Index Used | Performance |
|-----------|---------------|------------|-------------|
| `findById()` | `{ _id: id }` | Primary (`_id`) | O(1) - Excellent |
| `findAll()` | `{ status? }` + sort by `updatedAt` | `idx_status_updatedAt` | O(log n) - Good |
| `findActive()` | `{ status: { $in: [...] } }` + sort | `idx_status_updatedAt` | O(log n) - Good |
| `save()` | `{ _id: id }` | Primary (`_id`) | O(1) - Excellent |
| `delete()` | `{ _id: id }` | Primary (`_id`) | O(1) - Excellent |

**Optimization Opportunities:**

1. **Projection for List Queries**
   - When fetching conversation list, exclude `messages` array
   - Reduces network transfer by ~90% for large conversations

   ```typescript
   const documents = await this.collection
     .find({})
     .project({ messages: 0 })  // Exclude messages
     .sort({ updatedAt: -1 })
     .limit(100)
     .toArray();
   ```

2. **Aggregation Pipeline for Statistics**

   ```typescript
   async getConversationStats(): Promise<{
     totalConversations: number;
     avgMessagesPerConversation: number;
     statusBreakdown: Record<string, number>;
   }> {
     const result = await this.collection.aggregate([
       {
         $facet: {
           totalCount: [{ $count: 'count' }],
           avgMessages: [
             { $project: { messageCount: { $size: '$messages' } } },
             { $group: { _id: null, avg: { $avg: '$messageCount' } } }
           ],
           statusCounts: [
             { $group: { _id: '$status', count: { $sum: 1 } } }
           ]
         }
       }
     ]).toArray();

     // Process result...
   }
   ```

3. **Caching Layer (Future Optimization)**
   - Add Redis cache for frequently accessed conversations
   - Cache conversation metadata for list views
   - Invalidate on save/delete

### 8.2 Document Size Management

**Current Limits:**

- MongoDB document limit: **16MB**
- Conversation message limit: **1000 messages** (from domain)
- Estimated message size: ~1KB per message (with content + metadata)
- **Estimated max conversation size: ~1MB** (well within limit)

**Monitoring:**

```typescript
async checkDocumentSize(conversationId: string): Promise<number> {
  const document = await this.collection.findOne(
    { _id: conversationId },
    { projection: { _id: 1 } }
  );

  if (!document) return 0;

  // BSON.calculateObjectSize() from mongodb driver
  const bsonSize = BSON.calculateObjectSize(document);

  if (bsonSize > 10 * 1024 * 1024) {  // 10MB warning threshold
    console.warn(`Conversation ${conversationId} is ${bsonSize} bytes (approaching 16MB limit)`);
  }

  return bsonSize;
}
```

**Mitigation Strategy (if needed in future):**

1. Archive old messages to separate collection
2. Implement message pagination at domain level
3. Store message content in GridFS for very large messages

### 8.3 Connection Pool Tuning

**Recommended Settings for Next.js:**

```typescript
const mongoClientOptions = {
  maxPoolSize: 10,           // Serverless: Keep low (10)
  minPoolSize: 2,            // Maintain baseline connections
  maxIdleTimeMS: 60000,      // Close idle after 60s (important for serverless)
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};
```

**Why Low Pool Size?**

- Next.js API routes are stateless
- Each serverless function has its own connection pool
- High pool size wastes connections
- MongoDB Atlas M0 (free tier) allows max 100 concurrent connections

**Monitoring Connection Pool:**

```typescript
client.on('connectionPoolCreated', (event) => {
  console.log('Connection pool created:', event);
});

client.on('connectionPoolClosed', (event) => {
  console.log('Connection pool closed:', event);
});

client.on('connectionCheckedOut', (event) => {
  console.log('Connection checked out from pool');
});

client.on('connectionCheckedIn', (event) => {
  console.log('Connection checked in to pool');
});
```

---

## 9. Security Considerations

### 9.1 Connection String Security

**Environment Variable Storage:**

```bash
# .env (NEVER commit this file)
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority

# .env.example (commit this for documentation)
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=your_database_name
```

**Vercel Deployment:**

1. Add environment variables in Vercel dashboard
2. Use different MongoDB users for dev/staging/production
3. Enable IP allowlisting in MongoDB Atlas (use Vercel IP ranges)

**Best Practices:**

- ✅ Use MongoDB Atlas secrets management
- ✅ Rotate passwords regularly
- ✅ Use least-privilege principle (readWrite on specific database only)
- ❌ Never hardcode credentials
- ❌ Never log connection strings

### 9.2 Data Validation

**Input Sanitization:**

MongoDB Node.js driver automatically escapes queries, but:

1. **Validate entity data before saving**:
   ```typescript
   // In ConversationDocumentMapper.toDocument()
   if (!conversation.getId() || typeof conversation.getId() !== 'string') {
     throw new ValidationError('Invalid conversation ID');
   }
   ```

2. **Sanitize user input at API boundary**:
   ```typescript
   // In API route
   const { conversationId } = await request.json();

   if (conversationId && !isValidUUID(conversationId)) {
     return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
   }
   ```

3. **Use MongoDB schema validation** (optional):
   ```typescript
   await db.createCollection('conversations', {
     validator: {
       $jsonSchema: {
         bsonType: 'object',
         required: ['_id', 'status', 'messages', 'createdAt', 'updatedAt'],
         properties: {
           _id: { bsonType: 'string' },
           status: { enum: ['active', 'waiting_for_response', 'completed', 'archived'] },
           messages: { bsonType: 'array' },
           createdAt: { bsonType: 'date' },
           updatedAt: { bsonType: 'date' }
         }
       }
     }
   });
   ```

### 9.3 Access Control

**MongoDB User Permissions:**

```javascript
// In MongoDB Atlas, create user with limited permissions
{
  "role": "readWrite",
  "db": "ai_chat_app"
}
```

**API-Level Authorization (Future):**

When adding user authentication:

```typescript
async findByUser(userId: string): Promise<Conversation[]> {
  // Only return conversations belonging to this user
  const documents = await this.collection
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  return documents.map(doc => ConversationDocumentMapper.toEntity(doc));
}
```

---

## 10. Monitoring & Observability

### 10.1 Logging Strategy

**Recommended Logging Levels:**

```typescript
// Production: Log errors + warnings
// Development: Log info + debug

class MongoDBConversationRepository {
  private logger = {
    debug: (msg: string, meta?: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[MongoDB] ${msg}`, meta);
      }
    },
    info: (msg: string, meta?: any) => {
      console.info(`[MongoDB] ${msg}`, meta);
    },
    warn: (msg: string, meta?: any) => {
      console.warn(`[MongoDB] ${msg}`, meta);
    },
    error: (msg: string, error?: Error, meta?: any) => {
      console.error(`[MongoDB] ${msg}`, error, meta);
    },
  };

  async findById(id: string): Promise<Conversation | null> {
    this.logger.debug('Finding conversation by ID', { id });

    try {
      const document = await this.collection.findOne({ _id: id });

      if (!document) {
        this.logger.debug('Conversation not found', { id });
        return null;
      }

      this.logger.debug('Conversation found', { id, messageCount: document.messages.length });
      return ConversationDocumentMapper.toEntity(document);
    } catch (error) {
      this.logger.error('Error finding conversation', error as Error, { id });
      throw error;
    }
  }
}
```

### 10.2 Performance Monitoring

**MongoDB Atlas Performance Advisor:**

- Automatically suggests indexes based on query patterns
- Monitors slow queries (>100ms)
- Tracks query execution plans

**Application-Level Metrics:**

```typescript
class RepositoryMetrics {
  private queryDurations: number[] = [];

  async measureQuery<T>(
    operation: string,
    query: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await query();
      const duration = Date.now() - start;

      this.queryDurations.push(duration);

      if (duration > 1000) {  // Slow query threshold
        console.warn(`Slow ${operation} query: ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Failed ${operation} query after ${duration}ms:`, error);
      throw error;
    }
  }

  getAverageQueryDuration(): number {
    if (this.queryDurations.length === 0) return 0;
    const sum = this.queryDurations.reduce((a, b) => a + b, 0);
    return sum / this.queryDurations.length;
  }
}
```

### 10.3 Health Check Endpoint

**Comprehensive Health Check:**

```typescript
// app/api/health/route.ts
export async function GET() {
  const container = await getContainer();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: true,
      repository: {
        type: 'unknown',
        connected: false,
        conversationCount: 0,
      },
      mongodb: {
        connected: false,
        latency: 0,
      },
    },
    errors: [] as string[],
  };

  // Check repository
  try {
    const repository = container.getConversationRepository();

    if (repository instanceof MongoDBConversationRepository) {
      health.services.repository.type = 'mongodb';

      const startTime = Date.now();
      const isConnected = await repository.healthCheck();
      const latency = Date.now() - startTime;

      health.services.mongodb.connected = isConnected;
      health.services.mongodb.latency = latency;
      health.services.repository.connected = isConnected;
    } else {
      health.services.repository.type = 'inmemory';
      health.services.repository.connected = true;
    }

    health.services.repository.conversationCount = await repository.count();
  } catch (error) {
    health.status = 'unhealthy';
    health.errors.push(`Repository: ${(error as Error).message}`);
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
```

**Usage:**

- Monitor in production: Poll `/api/health` every 60 seconds
- Alert if status becomes 'unhealthy' for > 2 consecutive checks
- Use for Vercel health checks or uptime monitoring services

---

## 11. Summary & Next Steps

### 11.1 Implementation Priority

**Phase 1: Core Infrastructure (MVP)**
1. ✅ Create `MongoDBClient` singleton with connection pooling
2. ✅ Create `ConversationDocumentMapper` with full entity restoration
3. ✅ Implement `MongoDBConversationRepository` with all CRUD methods
4. ✅ Update `DependencyContainer` with async initialization and repository selection
5. ✅ Add environment variables and test with MongoDB Atlas

**Phase 2: Reliability & Monitoring**
6. ✅ Add health check endpoint (`/api/health`)
7. ✅ Implement retry logic for initial connection
8. ✅ Add comprehensive error logging
9. ✅ Test fallback to InMemory on connection failure

**Phase 3: Optimization (Post-MVP)**
10. ⬜ Add projection for list queries (exclude messages)
11. ⬜ Implement cursor-based pagination
12. ⬜ Add optimistic locking for concurrent updates
13. ⬜ Set up MongoDB Atlas Performance Advisor alerts

**Phase 4: Testing (Parallel to Phase 1)**
14. ✅ Write unit tests with MongoDB Memory Server
15. ✅ Write integration tests for DependencyContainer
16. ✅ Write E2E tests for API routes with MongoDB

### 11.2 Key Architectural Decisions Summary

| Decision Point | Recommendation | Rationale |
|----------------|----------------|-----------|
| **Driver** | Native MongoDB driver | Lighter weight, more control, no ORM overhead |
| **Connection** | Singleton with pooling | Efficient resource usage, automatic reconnection |
| **Schema** | Embedded messages | Aggregate root pattern, single-query retrieval |
| **Dates** | MongoDB Date objects | Native queries, better performance |
| **Indexes** | `updatedAt`, `status + updatedAt` | Optimized for common queries (findAll, findActive) |
| **Mapping** | Dedicated mapper class | Clean separation, testable, reusable |
| **Transactions** | Not needed | Single-document operations are atomic |
| **Pagination** | Skip + limit | Simpler for MVP, sufficient for 100 conversations |
| **Fallback** | Startup only | Avoid complex runtime state migration |
| **Error Handling** | Wrap in domain errors | Hide infrastructure details from application layer |

### 11.3 Important Implementation Notes

**Critical Points to Remember:**

1. **Use `Conversation.restore()`**: Never rebuild entities with `.create()` + `.addMessage()`
2. **Handle Tool Invocation State**: Must manually replay state transitions when mapping
3. **Async Container Initialization**: Update API routes to await container creation
4. **Environment-Based Selection**: Always provide fallback to InMemory
5. **Date Objects, Not Strings**: Keep MongoDB dates as Date objects for query performance
6. **Index Creation**: Call `createIndexes()` once on repository initialization
7. **Connection Pooling**: Use low `maxPoolSize` (10) for serverless environments
8. **Error Logging**: Always log MongoDB errors with full context for debugging

### 11.4 Questions to Clarify Before Implementation

Before you start coding, Fran, please confirm:

1. **MongoDB Atlas Setup**: Do you want me to guide you through setting up the Atlas cluster, or will you handle that separately?

2. **Package Installation**: The `mongodb` driver should already be installed as a dependency of `@vercel/kv`. Should I verify this, or do you want to install it explicitly?

3. **Testing Strategy**: Do you want to implement tests alongside the repository, or implement repository first and tests later?

4. **Environment Variables**: Should I create a `.env.example` file with all required variables?

5. **Health Check Priority**: Is the health check endpoint critical for MVP, or can it be implemented in Phase 2?

6. **Logging Library**: Do you want to use a structured logging library (e.g., `pino`, `winston`), or stick with `console.log`?

7. **Migration Concerns**: Since InMemory is transient, do you want any data export/import functionality before switching to MongoDB?

---

## 12. File Structure Reference

**Complete File Structure After Implementation:**

```
src/
  domain/
    entities/
      Conversation.ts              # ✅ Existing
      Message.ts                   # ✅ Existing
      ToolInvocation.ts            # ✅ Existing
    repositories/
      IConversationRepository.ts   # ✅ Existing (interface)

  infrastructure/
    adapters/
      database/
        MongoDBClient.ts           # 🆕 CREATE - Singleton connection manager
        MongoDBConversationRepository.ts  # 🆕 CREATE - Repository implementation
        types/
          ConversationDocument.ts  # 🆕 CREATE - TypeScript document interfaces
        mappers/
          ConversationDocumentMapper.ts  # 🆕 CREATE - Entity <-> Document mapper
    repositories/
      InMemoryConversationRepository.ts  # ✅ Existing
    config/
      DependencyContainer.ts       # 🔄 UPDATE - Add MongoDB initialization

  application/
    use-cases/
      ManageConversationUseCase.ts # ✅ Existing (no changes needed)

app/
  api/
    conversations/
      route.ts                     # 🔄 UPDATE - Await container initialization
    health/
      route.ts                     # 🆕 CREATE - Health check endpoint

.env.example                       # 🆕 CREATE - Environment variable template
```

**Legend:**
- ✅ Existing - Already implemented
- 🆕 CREATE - New file to create
- 🔄 UPDATE - Existing file to modify

---

## 13. Environment Configuration Template

**Create `.env.example`:**

```bash
# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-...your-api-key

# MongoDB Configuration (Required for MongoDB repository)
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=ai_chat_app

# Repository Selection (Optional - defaults to 'inmemory')
# Options: 'mongodb' | 'inmemory'
REPOSITORY_TYPE=mongodb

# Application Environment
NODE_ENV=development  # or 'production'
```

**Create `.env.local` (for local development):**

```bash
# Copy .env.example to .env.local and fill in actual values
OPENAI_API_KEY=sk-...actual-key
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=ai_chat_app_dev
REPOSITORY_TYPE=inmemory  # Use inmemory for local dev, mongodb for testing
NODE_ENV=development
```

---

## Conclusion

This architectural guidance provides a comprehensive blueprint for implementing the MongoDB repository adapter while maintaining the integrity of your hexagonal architecture. The approach prioritizes:

- **Clean Architecture**: Clear separation between domain, application, and infrastructure
- **Resilience**: Graceful error handling and fallback mechanisms
- **Performance**: Optimized queries, proper indexing, and connection pooling
- **Maintainability**: Dedicated mapper, comprehensive logging, and health monitoring
- **Testability**: Isolated components with clear interfaces

The implementation follows DDD principles, ensuring the domain remains pure and infrastructure concerns are properly abstracted behind the `IConversationRepository` interface.

**Next Steps**: Once you confirm the clarifying questions, I'll be ready to guide you through the actual implementation following this architectural blueprint.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-08
**Author**: Hexagonal Backend Architect Agent
**Review Status**: Ready for Implementation
