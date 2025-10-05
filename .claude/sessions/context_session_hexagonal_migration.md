# Context Session: Hexagonal Architecture Migration

## Session Started: 2025-10-05

## Objective
Migrate the Next.js AI chat application from traditional MVC structure to hexagonal architecture, moving `/app/utils/*` and `/app/api/chat/` to a clean domain-driven design.

## Current Architecture Analysis

### Existing Structure
- **app/utils/types.ts**: Basic type definitions (ClientMessage, ToolInvocation, ClientAttachment)
- **app/utils/prompt.ts**: OpenAI message conversion utility
- **app/utils/tools.ts**: Weather tool implementation
- **app/api/chat/route.ts**: Monolithic API route handling streaming, tools, and OpenAI integration

### Problems Identified
1. Business logic mixed with infrastructure concerns
2. Direct dependency on OpenAI SDK in API routes
3. No clear domain model - just DTOs
4. Tight coupling to Vercel streaming protocol
5. Limited testability - cannot test business logic in isolation

## Hexagonal Architecture Design

### Core Principles
- **Domain Independence**: Business logic has zero framework dependencies
- **Port & Adapters**: Clear interfaces between layers
- **Dependency Inversion**: Infrastructure depends on domain, not vice versa
- **Single Responsibility**: Each component has one reason to change

### Layer Responsibilities

#### Domain Layer (src/domain/)
- Pure business logic and rules
- Domain entities with behavior
- Value objects with validation
- Domain services for complex operations
- Repository interfaces (ports)
- Domain-specific exceptions

#### Application Layer (src/application/)
- Use case orchestration
- Port definitions (inbound/outbound)
- DTOs for API boundaries
- Mappers between domain and DTOs
- Application-specific logic

#### Infrastructure Layer (src/infrastructure/)
- External service adapters (OpenAI, Weather API)
- Repository implementations
- Streaming protocol adapters
- Configuration and DI container
- Framework-specific code

#### Presentation Layer (src/presentation/)
- Thin controllers (Next.js API routes)
- HTTP request/response handling
- Delegates to use cases

## Implementation Progress

### Phase 1: Domain Layer Foundation ✅
- [x] Created directory structure
- [x] Implement value objects
  - MessageRole: Role validation and type safety
  - MessageContent: Content validation
  - Coordinates: Geographic validation with distance calculation
  - ToolName: Tool naming conventions
  - Attachment: File metadata validation
- [x] Implement domain entities
  - Conversation: Aggregate root with message management
  - Message: Message validation and relationships
  - ToolInvocation: State machine for tool lifecycle
  - StreamingResponse: Streaming chunk management
- [x] Create domain services
  - MessageValidator: Complex validation rules
  - ConversationOrchestrator: Conversation flow coordination
- [x] Define domain exceptions
  - InvalidMessageError
  - ToolExecutionError
  - StreamingError
  - ConversationError
- [x] Create repository interface
  - IConversationRepository

### Phase 2: Application Layer ✅
- [x] Define port interfaces
  - Inbound: IChatService, IStreamingService
  - Outbound: IAIProvider, IToolRegistry, IStreamAdapter, IWeatherService
- [x] Create DTOs and mappers
  - MessageDto, ChatRequestDto, ChatResponseDto, ConversationDto
  - MessageMapper, ConversationMapper
- [x] Implement use cases
  - StreamChatCompletionUseCase: Orchestrates streaming with tools
  - SendMessageUseCase: Message handling and validation
  - ExecuteToolUseCase: Individual tool execution
  - ManageConversationUseCase: Conversation lifecycle

### Phase 3: Infrastructure Adapters ✅
- [x] OpenAI adapter with message converter
- [x] Vercel stream adapter with encoder
- [x] Weather tool adapter and tool implementation
- [x] Tool registry for managing tools
- [x] In-memory repository implementation
- [ ] Integration tests

### Phase 4: Dependency Injection ✅
- [x] DependencyContainer with health checks
- [x] Environment configuration
- [x] Container initialization and management
- [ ] Container tests

### Phase 5: Presentation Layer ✅
- [x] Thin API route controller
- [x] Error handling
- [x] V2 API route for gradual migration
- [ ] API tests

## Key Design Decisions

### 1. Domain Entities vs Value Objects
- **Entities**: Have identity and lifecycle (Conversation, Message, ToolInvocation)
- **Value Objects**: Immutable, compared by value (MessageRole, Coordinates, MessageContent)

### 2. Use Case Pattern
Each use case represents a single user intent:
- StreamChatCompletionUseCase: Handles streaming AI responses with tools
- SendMessageUseCase: Adds messages to conversations
- ExecuteToolUseCase: Executes individual tools
- ManageConversationUseCase: Conversation lifecycle management

### 3. Repository Pattern
- Interface defined in domain layer
- Implementation in infrastructure layer
- Currently using in-memory, can swap to database without changing domain

### 4. Streaming Strategy
- Domain defines StreamingResponse entity
- Application defines IStreamAdapter port
- Infrastructure implements specific protocol (Vercel Data Stream v1)

### 5. Tool System
- Domain defines ToolInvocation entity with state machine
- Application defines IToolRegistry port
- Infrastructure implements specific tools (Weather)

### 6. Port Design
- **Inbound Ports**: What the application offers (IChatService, IStreamingService)
- **Outbound Ports**: What the application needs (IAIProvider, IToolRegistry, IStreamAdapter, IWeatherService)

## Testing Strategy

### Unit Tests (Domain)
- No infrastructure dependencies
- Test business rules and validation
- Test entity state transitions

### Integration Tests (Use Cases)
- Mock all ports
- Test use case orchestration
- Verify port interactions

### E2E Tests (API)
- Full stack testing
- Test streaming behavior
- Test tool execution

## Migration Notes

### Gradual Migration Approach
1. Build new architecture alongside existing
2. Run both in parallel initially
3. Gradually route traffic to new implementation
4. Remove old code once stable

### Backward Compatibility
- Keep same API contract for frontend
- Maintain Vercel Data Stream Protocol v1
- No changes needed in React components

## Next Steps
1. ✅ Implement domain value objects
2. ✅ Create domain entities with business logic
3. ✅ Create domain services and repository interface
4. ✅ Implement application layer ports
5. ✅ Create DTOs and mappers
6. ✅ Implement use cases
7. 🔄 Create infrastructure adapters (OpenAI, Vercel Stream, Weather, Tool Registry)
8. Implement dependency injection container
9. Create thin presentation layer
10. Write comprehensive tests

## Technical Decisions Log

### 2025-10-05
- Decided to use Result<T, E> pattern for error handling (to be implemented)
- Chose in-memory repository for initial implementation
- Using factory methods for entity creation
- Implementing state machine pattern for ToolInvocation
- Created comprehensive use cases for all operations
- Designed flexible port interfaces for easy adapter swapping

## Architecture Benefits Achieved

### Domain Layer
- ✅ 100% framework-independent
- ✅ Pure business logic with no external dependencies
- ✅ Comprehensive validation and business rules
- ✅ Rich domain model with behavior
- ✅ State machines for complex workflows

### Application Layer
- ✅ Clear use case definitions
- ✅ Port interfaces for dependency inversion
- ✅ DTOs for API contracts
- ✅ Mappers for data transformation
- ✅ Orchestration of domain operations

## Resources
- Original codebase analyzed
- Hexagonal architecture best practices applied
- TypeScript/Next.js patterns considered
- Domain-Driven Design principles followed

## Infrastructure Benefits Achieved

### Infrastructure Layer
- ✅ OpenAI adapter with full streaming support
- ✅ Vercel Data Stream Protocol v1 implementation
- ✅ Weather service with OpenMeteo API
- ✅ Tool registry with dynamic registration
- ✅ In-memory repository with statistics
- ✅ Dependency injection container with health checks

### API Migration Strategy
- ✅ Original API remains at `/api/chat`
- ✅ New hexagonal API at `/api/v2/chat`
- ✅ Both APIs can run in parallel
- ✅ Gradual migration path established
- ✅ Same contract maintained for frontend

## Files Created

### Domain Layer
- src/domain/value-objects/MessageRole.ts
- src/domain/value-objects/MessageContent.ts
- src/domain/value-objects/Coordinates.ts
- src/domain/value-objects/ToolName.ts
- src/domain/value-objects/Attachment.ts
- src/domain/entities/ToolInvocation.ts
- src/domain/entities/Message.ts
- src/domain/entities/Conversation.ts
- src/domain/entities/StreamingResponse.ts
- src/domain/services/MessageValidator.ts
- src/domain/services/ConversationOrchestrator.ts
- src/domain/repositories/IConversationRepository.ts
- src/domain/exceptions/InvalidMessageError.ts
- src/domain/exceptions/ToolExecutionError.ts
- src/domain/exceptions/StreamingError.ts
- src/domain/exceptions/ConversationError.ts

### Application Layer
- src/application/ports/inbound/IChatService.ts
- src/application/ports/inbound/IStreamingService.ts
- src/application/ports/outbound/IAIProvider.ts
- src/application/ports/outbound/IToolRegistry.ts
- src/application/ports/outbound/IStreamAdapter.ts
- src/application/ports/outbound/IWeatherService.ts
- src/application/dto/MessageDto.ts
- src/application/dto/ChatRequestDto.ts
- src/application/dto/ChatResponseDto.ts
- src/application/dto/ConversationDto.ts
- src/application/mappers/MessageMapper.ts
- src/application/mappers/ConversationMapper.ts
- src/application/use-cases/StreamChatCompletionUseCase.ts
- src/application/use-cases/SendMessageUseCase.ts
- src/application/use-cases/ExecuteToolUseCase.ts
- src/application/use-cases/ManageConversationUseCase.ts

### Infrastructure Layer
- src/infrastructure/adapters/ai/OpenAIAdapter.ts
- src/infrastructure/adapters/ai/OpenAIMessageConverter.ts
- src/infrastructure/adapters/streaming/VercelStreamAdapter.ts
- src/infrastructure/adapters/streaming/StreamEncoder.ts
- src/infrastructure/adapters/tools/WeatherToolAdapter.ts
- src/infrastructure/adapters/tools/WeatherTool.ts
- src/infrastructure/adapters/tools/ToolRegistry.ts
- src/infrastructure/repositories/InMemoryConversationRepository.ts
- src/infrastructure/config/DependencyContainer.ts

### Presentation Layer
- src/presentation/api/chat/route.ts
- app/api/v2/chat/route.ts (forwards to presentation layer)

### Configuration
- Updated tsconfig.json with new path aliases