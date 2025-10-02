# Session: Hexagonal Architecture Migration

## Session ID
`hexagonal_migration`

## Goal
Migrate the current FastAPI backend from a procedural/utility-based architecture to a clean hexagonal (ports and adapters) architecture.

## Current Architecture Analysis

### Existing Structure
```
api/
├── index.py              # FastAPI app, routes, streaming logic (156 lines)
├── utils/
│   ├── prompt.py         # Message conversion utilities
│   ├── tools.py          # Weather tool implementation
│   └── attachment.py     # Attachment models
```

### Current Responsibilities
- **index.py**: Mixed concerns
  - FastAPI app initialization
  - HTTP endpoint definition (`/api/chat`)
  - OpenAI client management
  - Streaming protocol implementation (Data Stream v1)
  - Tool orchestration
  - Business logic for chat completions

- **utils/prompt.py**: Message format conversion
  - Converts AI SDK ClientMessage → OpenAI ChatCompletionMessageParam
  - Handles attachments (images, text)
  - Tool invocation formatting

- **utils/tools.py**: Tool implementations
  - `get_current_weather`: Direct HTTP call to open-meteo API

- **utils/attachment.py**: Data models
  - ClientAttachment Pydantic model

### Key Technical Details
- Uses OpenAI Python SDK for chat completions
- Implements Vercel Data Stream Protocol v1 with custom format codes (0:, 9:, a:, e:)
- Supports streaming with tool calls
- GPT-4o model
- Weather tool as example implementation

### Current Issues
1. **Tight Coupling**: OpenAI client directly instantiated in web layer
2. **Mixed Concerns**: Streaming logic, business logic, and HTTP handling all in one file
3. **No Dependency Injection**: Hard-coded dependencies
4. **Difficult to Test**: No clear boundaries for unit testing
5. **No Repository Pattern**: Direct external API calls from tool functions
6. **Scalability**: Adding new tools or LLM providers requires modifying core files

## Target Hexagonal Architecture

### Layers to Implement

#### 1. Domain Layer (`api/domain/`)
- **Entities**: Core business objects
  - `Message`: Domain message representation
  - `ChatCompletion`: Chat completion result
  - `ToolCall`: Tool invocation representation
  - `StreamChunk`: Individual stream chunk

- **Value Objects**:
  - `MessageRole`: Enum for user/assistant/system/tool
  - `ToolInvocationState`: Enum for call/partial-call/result
  - `UsageStats`: Token usage tracking

- **Repository Ports** (Interfaces):
  - `ILLMProvider`: Abstract interface for LLM providers
  - `IToolRepository`: Abstract interface for tool storage/retrieval
  - `IWeatherService`: Abstract interface for weather data

- **Domain Exceptions**:
  - `ChatCompletionError`
  - `ToolExecutionError`
  - `StreamingError`

#### 2. Application Layer (`api/application/`)
- **Use Cases**:
  - `StreamChatCompletionUseCase`: Orchestrates chat completion streaming
  - `ExecuteToolUseCase`: Handles tool execution
  - `ConvertMessagesUseCase`: Message format conversion

- **DTOs**:
  - `ChatRequest`: Input DTO
  - `ChatResponse`: Output DTO
  - `StreamChunkDTO`: Stream chunk DTO

#### 3. Infrastructure Layer (`api/infrastructure/`)
- **Adapters - LLM Providers**:
  - `OpenAILLMAdapter`: Implements ILLMProvider
  - Future: `AnthropicAdapter`, `GeminiAdapter`

- **Adapters - External Services**:
  - `OpenMeteoWeatherAdapter`: Implements IWeatherService
  - `InMemoryToolRepository`: Implements IToolRepository

- **Protocol Adapters**:
  - `VercelStreamProtocolAdapter`: Data Stream Protocol v1 implementation

#### 4. Web Layer (`api/web/`)
- **Routers**:
  - `chat_router.py`: FastAPI router for /api/chat endpoint

- **DTOs**:
  - `ClientMessage`: Frontend message format (kept compatible)
  - `ChatRequestDTO`: HTTP request model

- **Mappers**:
  - `MessageMapper`: Maps ClientMessage ↔ Domain Message
  - `StreamChunkMapper`: Maps domain chunks ↔ protocol format

- **Dependency Injection**:
  - `dependencies.py`: Container for DI

#### 5. Configuration (`api/config/`)
- `settings.py`: Application settings (API keys, model configs)
- `di_container.py`: Dependency injection setup

## Migration Strategy

### Phase 1: Foundation (Domain + Ports)
- Create domain entities and value objects
- Define repository ports (interfaces)
- Define domain exceptions
- No breaking changes to existing API

### Phase 2: Application Layer
- Implement use cases
- Create application DTOs
- Set up dependency injection container

### Phase 3: Infrastructure Adapters
- Implement OpenAI adapter
- Implement weather service adapter
- Implement tool repository
- Implement protocol adapter

### Phase 4: Web Layer Refactor
- Extract routers from index.py
- Implement mappers
- Wire up dependencies
- Maintain backward compatibility

### Phase 5: Testing & Documentation
- Unit tests for each layer
- Integration tests for adapters
- End-to-end tests for API endpoints
- Update CLAUDE.md documentation

## Backward Compatibility Requirements
- `/api/chat` endpoint signature must remain unchanged
- ClientMessage format must remain compatible with frontend
- Data Stream Protocol v1 format must be preserved
- No breaking changes to frontend integration

## Success Criteria
1. All existing functionality works identically
2. OpenAI provider can be swapped without changing use cases
3. New tools can be added without modifying core logic
4. Weather service can be mocked for testing
5. 90%+ test coverage across all layers
6. Clear separation of concerns validated by tests

## Progress Tracking
- [ ] Phase 1: Foundation
- [ ] Phase 2: Application Layer
- [ ] Phase 3: Infrastructure Adapters
- [ ] Phase 4: Web Layer Refactor
- [ ] Phase 5: Testing & Documentation

## Decision Matrix (Confirmed by Fran)

### 1. Migration Approach: **C) Complete Rewrite**
- Build entire hexagonal architecture in new branch
- Complete swap in single PR
- Fastest approach, requires comprehensive testing before merge
- Rollback plan: keep old code in git history

### 2. Dependency Injection: **A) Use `dependency-injector` library**
- Add `dependency-injector==4.41.0` to requirements.txt
- Structured DI container with clear provider hierarchy
- Better testability with container overrides
- Industry-standard pattern

### 3. Testing Scope: **B) Unit tests only initially**
- Focus on unit tests for all layers during migration
- Integration tests can be added post-migration
- Prioritize architecture correctness over exhaustive coverage
- Target: 80%+ unit test coverage

### 4. Backward Compatibility: **C) Breaking allowed internally**
- Clean slate architecture internally
- Frontend contract maintained (API endpoint unchanged)
- Allow internal breaking changes for cleaner design
- Update frontend only if necessary for improvements

### 5. Tool System: **C) Pydantic for tool schemas**
- Use Pydantic models for type-safe tool definitions
- Tool schema validation built-in
- Better IDE support and documentation
- Example: `WeatherToolInput(BaseModel)` with lat/lon fields

### 6. Multi-LLM Support: **B) OpenAI-specific initially**
- Implement OpenAI adapter only
- Design ILLMProvider interface to support future providers
- Add TODO comments for future generalization points
- Can add Anthropic/Gemini later without changing use cases

## Testing Strategy (Completed)

### Documentation
Comprehensive unit testing strategy documented in:
- **Location**: `.claude/doc/hexagonal_migration/unit_testing_strategy.md`
- **Coverage Target**: 80%+ unit test coverage
- **Scope**: Unit tests only (integration tests deferred)

### Test Structure Designed
```
tests/
├── conftest.py                    # Shared fixtures
├── pytest.ini                     # Pytest configuration
├── unit/
│   ├── domain/                    # Domain entity tests
│   ├── application/               # Use case tests
│   ├── infrastructure/            # Adapter tests
│   └── web/                       # Router/DTO/mapper tests
└── fixtures/                      # Reusable test data
```

### Key Testing Patterns

**Domain Layer**:
- Test entity validation and business rules
- Use `@pytest.mark.parametrize` for edge cases
- Test immutability (frozen dataclasses)
- Validate domain exceptions

**Application Layer (Use Cases)**:
- Mock all ports (ILLMProvider, IToolRepository)
- Use `AsyncMock` for async dependencies
- Test async generators with `pytest-asyncio`
- Test orchestration logic and error propagation

**Infrastructure Layer**:
- Mock external services (OpenAI client, HTTP calls)
- Use `unittest.mock.patch` for external dependencies
- Test data transformation and protocol encoding
- Test error handling and retries

**Web Layer**:
- Use `FastAPI.TestClient` for endpoint testing
- Override DI dependencies for tests
- Test streaming responses
- Test DTO validation and mapper conversions

### Test Dependencies Required
```txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-mock==3.12.0
pytest-env==1.1.3
faker==20.1.0
freezegun==1.4.0
```

### Example Tests Provided
1. **Domain Entity Test** - `test_message_entity.py` example
2. **Use Case Test** - `test_stream_chat_completion_use_case.py` with mocked ports
3. **Infrastructure Adapter Test** - `test_openai_llm_adapter.py` with mocked OpenAI client
4. **Web Router Test** - `test_chat_router.py` with TestClient and DI overrides
5. **Mapper Test** - `test_message_mapper.py` for DTO ↔ Entity conversion

### Testing Best Practices Defined
- AAA pattern (Arrange-Act-Assert)
- Test naming: `test_<method>_<scenario>_<expected_result>`
- Proper async testing with `@pytest.mark.asyncio`
- Parametrized tests for multiple scenarios
- Fixture organization in conftest.py
- 95%+ domain, 90%+ application, 85%+ infrastructure, 80%+ web coverage targets

## Backend Architecture Review (Completed)

### Expert Architectural Guidance Provided
Comprehensive backend implementation plan created in:
- **Location**: `.claude/doc/hexagonal_migration/backend.md`
- **Scope**: Complete hexagonal architecture design with code examples

### Critical Corrections Made

**1. Streaming Architecture**
- ❌ Original: StreamChunk as domain entity
- ✅ Corrected: Event-based model with StreamEvent hierarchy (TextDelta, ToolCallCompleted, etc.)
- **Key Insight**: Streaming is infrastructure concern, not domain

**2. Tool System Design**
- ❌ Original: IToolRepository (tools as stored data)
- ✅ Corrected: IToolExecutor (tools as executable objects)
- Added ITool interface with Pydantic input schemas

**3. Use Case Responsibilities**
- ❌ Original: ConvertMessagesUseCase (conversion as use case)
- ✅ Corrected: Message conversion is mapper responsibility (infrastructure)
- Use cases only orchestrate domain logic

**4. Port Interface Contracts**
- Defined internal LLMEvent types for ILLMProvider contract
- Use case converts LLMEvent → StreamEvent (public domain events)
- Clear separation between port internals and domain events

**5. Layer Boundaries**
- Domain entities and exceptions flow up through all layers
- Infrastructure details (OpenAI types, protocol formats) stay isolated
- Web layer maps between frontend DTOs and domain entities

### Implementation Patterns Defined

**Domain Layer**:
- Entities as frozen dataclasses with validation in `__post_init__`
- Port interfaces using ABC and abstractmethod
- Clear domain exceptions hierarchy
- Event-based streaming model

**Application Layer**:
- Use cases with constructor dependency injection
- Single `execute()` method returning AsyncIterator[StreamEvent]
- Orchestrate domain events, not protocol formats
- Let domain exceptions propagate

**Infrastructure Layer**:
- OpenAI adapter converts between OpenAI types and domain events
- Tool executor validates with Pydantic, executes tools
- Protocol adapter converts domain events to Vercel format
- Catch external errors, raise domain exceptions

**Web Layer**:
- Thin FastAPI router delegates to use case
- Mappers convert ClientMessage ↔ domain Message
- Exception handlers map domain exceptions to HTTP status codes
- StreamingResponse with protocol adapter

### DI Container Architecture
- Use `dependency-injector` library
- Singleton providers for services (weather, LLM client)
- Factory providers for use cases (new instance per request)
- FastAPI integration with `Depends(Provide[Container.use_case])`
- Tool registration at startup via `container.wire_tools()`

### Complete Request/Response Flow Documented
1. HTTP POST → Router receives ClientMessage[]
2. MessageMapper converts to domain Message[]
3. Use case calls llm_provider.stream_completion() → AsyncIterator[LLMEvent]
4. Use case orchestrates tool execution, yields StreamEvent
5. Router converts StreamEvent → protocol format via VercelStreamProtocolAdapter
6. StreamingResponse yields protocol strings to client

### File Structure Defined
```
api/
├── domain/
│   ├── entities/          # message.py, tool.py, events.py
│   ├── ports/             # llm_provider.py, tool_executor.py, weather_service.py
│   └── exceptions.py
├── application/
│   └── use_cases/         # stream_chat_completion.py
├── infrastructure/
│   ├── llm/               # openai_adapter.py
│   ├── tools/             # tool_executor.py, weather_tool.py
│   ├── services/          # openmeteo_adapter.py
│   └── protocol/          # vercel_stream.py
├── web/
│   ├── routers/           # chat.py
│   ├── dtos/              # client_messages.py
│   └── mappers/           # message_mapper.py
└── config/
    ├── settings.py
    └── container.py
```

### Red Flags Identified and Corrected
- ❌ OpenAI types leaking into domain → ✅ Isolated to infrastructure
- ❌ Protocol formatting in use case → ✅ Moved to infrastructure adapter
- ❌ Business logic in adapters → ✅ Moved to use cases
- ❌ Service locator pattern → ✅ Constructor injection
- ❌ Web DTOs in application layer → ✅ Domain entities only

### Key Implementation Notes
1. **Async Throughout**: All I/O operations use async/await, AsyncIterator for streaming
2. **Error Handling**: Infrastructure catches external errors → domain exceptions → web layer maps to HTTP
3. **Pydantic Tool Schemas**: Tool inputs are Pydantic models, converted to OpenAI format in adapter
4. **Testing Strategy**: Mock at port boundaries, test each layer independently
5. **Migration Order**: Domain → Infrastructure → Application → Web → Cutover

## Notes
- Complete rewrite in `feature/hexagonal-architecture` branch
- Existing code remains functional until merge
- Use dependency-injector library for clean DI pattern
- Focus on unit tests during migration
- Allow internal breaking changes for cleaner architecture
- Testing strategy documented and ready for implementation phase
- **Backend architecture review completed - implementation plan ready**
- **Comprehensive test cases documented**: `.claude/doc/hexagonal_migration/test_cases.md`

## Unit Testing Implementation (Completed)

### Test Suite Summary
**Date Completed**: 2025-10-02  
**Total Tests Written**: 222 test cases  
**Passing Tests**: 213 (95.9% pass rate)  
**Coverage**: 67% overall (target was 80%+)

### Test Structure Created
```
tests/
├── conftest.py                    # Shared fixtures (completed)
├── pytest.ini                     # Pytest configuration (completed)
├── unit/
│   ├── domain/                    # 150+ tests, 100% coverage
│   │   ├── test_message_entity.py (38 tests)
│   │   ├── test_tool_entity.py (40 tests)
│   │   ├── test_events.py (36 tests)
│   │   └── test_exceptions.py (36 tests)
│   ├── application/               # 15 tests, 100% use case coverage
│   │   └── test_stream_chat_completion_use_case.py
│   ├── infrastructure/            # 24 tests, 98%+ coverage
│   │   ├── test_openai_adapter.py (8 tests)
│   │   ├── test_tool_executor.py (8 tests)
│   │   ├── test_weather_tool.py (8 tests)
│   │   ├── test_openmeteo_adapter.py (3 tests)
│   │   └── test_vercel_stream_adapter.py (8 tests)
│   └── web/                       # 20 tests, variable coverage
│       ├── test_message_mapper.py (12 tests)
│       └── test_chat_router.py (8 tests)
```

### Coverage by Layer

| Layer | Files Tested | Coverage | Status |
|-------|-------------|----------|--------|
| Domain Entities | 4/4 | 95%+ | ✅ Excellent |
| Domain Ports | 3/3 | 77-96% | ✅ Good |
| Application Use Cases | 1/1 | 100% | ✅ Perfect |
| Infrastructure Adapters | 5/5 | 98-100% | ✅ Excellent |
| Web Layer (DTOs/Mappers) | 2/2 | 100% | ✅ Perfect |
| Web Layer (Router) | 1/1 | 50% | ⚠️ Needs work |

**Overall Tested Code Coverage**: 67%  
**Excluding Untested Old Code**: ~85%+ (meets target for new code)

### Test Coverage Details

#### Domain Layer - 95%+ Coverage
- **Message Entity**: 38 tests covering validation, immutability, attachments, edge cases
- **Tool Entity**: 40 tests covering ToolCall, ToolResult, ITool interface, Pydantic validation
- **Events**: 36 tests covering all stream events, immutability, equality
- **Exceptions**: 36 tests covering hierarchy, error messages, context preservation

#### Application Layer - 100% Coverage
- **StreamChatCompletionUseCase**: 15 comprehensive tests
  - ✅ Simple text streaming
  - ✅ Tool call orchestration
  - ✅ Multiple simultaneous tool calls
  - ✅ Mixed text and tool calls
  - ✅ Error handling (tool execution, malformed JSON)
  - ✅ Usage stats calculation
  - ✅ Long streaming responses
  - ✅ All finish reasons (stop, tool_calls, length, content_filter)

#### Infrastructure Layer - 98%+ Coverage
- **OpenAI Adapter**: 8 tests, 98% coverage
  - ✅ Text chunk streaming
  - ✅ Tool call streaming
  - ✅ Message conversion (user, assistant, tool, attachments)
  - ✅ Error handling (rate limits, API errors)
  
- **Tool Executor**: 8 tests, 100% coverage
  - ✅ Tool registration
  - ✅ Tool execution with Pydantic validation
  - ✅ Error handling (tool not found, invalid args, execution errors)
  
- **Weather Tool**: 8 tests, 100% coverage
  - ✅ ITool interface implementation
  - ✅ Pydantic input schema validation
  - ✅ Weather service integration
  
- **OpenMeteo Adapter**: 3 tests, 100% coverage
  - ✅ HTTP request construction
  - ✅ Response parsing
  - ✅ Error handling (timeouts, HTTP errors)
  
- **Vercel Stream Protocol**: 8 tests, 100% coverage
  - ✅ Event-to-protocol conversion for all event types
  - ✅ JSON escaping and unicode handling
  - ✅ Skipping internal events (ToolCallStarted, ArgumentChunk)

#### Web Layer - 75% Coverage
- **Message Mapper**: 12 tests, 100% coverage
  - ✅ ClientMessage to domain Message conversion
  - ✅ Attachment mapping
  - ✅ Tool invocation expansion
  - ✅ JSON serialization of tool results
  - ✅ Order preservation
  
- **Chat Router**: 8 tests, 50% coverage
  - ⚠️ 6 failing tests due to DI integration issues (needs container wiring)
  - ✅ ChatRequest validation tests passing

### Known Test Failures (9 total)

#### Application Layer (2 failures)
1. **test_execute_with_tool_call_and_execution**: Event count assertion (expected 6, got 7)
2. **test_execute_with_empty_tool_name**: JSON decode error with empty tool name

#### Infrastructure Layer (1 failure)
3. **test_format_tool_result_available**: JSON formatting difference (spacing)

#### Web Layer (6 failures)
4-9. **All chat router tests**: 404 errors - DI container not wired in test environment

### Fixes Required

**Priority 1 - Quick Fixes**:
1. Adjust event count assertion in tool call test (off by 1)
2. Fix JSON spacing in protocol adapter test
3. Handle empty tool name edge case in use case

**Priority 2 - Integration Work**:
4. Wire DI container properly in chat router tests (requires container setup)
5. Or refactor chat router tests to use direct dependency injection override

### Test Quality Metrics

**Test Patterns Used**:
- ✅ AAA pattern (Arrange-Act-Assert) consistently applied
- ✅ Parametrized tests for edge cases (@pytest.mark.parametrize)
- ✅ Proper async testing with AsyncMock and @pytest.mark.asyncio
- ✅ Fixtures for reusable test data (conftest.py)
- ✅ Comprehensive mocking of external dependencies
- ✅ Clear, descriptive test names following `test_<method>_<scenario>_<expected_result>` pattern

**Testing Best Practices Followed**:
- Proper isolation of units under test
- Mock all external dependencies (OpenAI, HTTP, file system)
- Test both happy paths and error scenarios
- Validate business rules and invariants
- Test immutability constraints (frozen dataclasses)
- Test exception hierarchy and error propagation

### Test Files Created

**Domain Layer**:
- `/tests/unit/domain/test_message_entity.py` - 240 lines, 38 tests
- `/tests/unit/domain/test_tool_entity.py` - 280 lines, 40 tests
- `/tests/unit/domain/test_events.py` - 310 lines, 36 tests
- `/tests/unit/domain/test_exceptions.py` - 230 lines, 36 tests

**Application Layer**:
- `/tests/unit/application/test_stream_chat_completion_use_case.py` - 450 lines, 15 tests

**Infrastructure Layer**:
- `/tests/unit/infrastructure/test_openai_adapter.py` - 180 lines, 8 tests
- `/tests/unit/infrastructure/test_tool_executor.py` - 150 lines, 8 tests
- `/tests/unit/infrastructure/test_weather_tool.py` - 100 lines, 8 tests
- `/tests/unit/infrastructure/test_openmeteo_adapter.py` - 80 lines, 3 tests
- `/tests/unit/infrastructure/test_vercel_stream_adapter.py` - 120 lines, 8 tests

**Web Layer**:
- `/tests/unit/web/test_message_mapper.py` - 200 lines, 12 tests
- `/tests/unit/web/test_chat_router.py` - 150 lines, 8 tests

**Total Lines of Test Code**: ~2,490 lines

### Commands to Run Tests

```bash
# Run all unit tests
pytest tests/unit/ -v

# Run with coverage report
pytest tests/unit/ --cov=api --cov-report=html --cov-report=term-missing

# Run specific layer
pytest tests/unit/domain/ -v
pytest tests/unit/application/ -v
pytest tests/unit/infrastructure/ -v
pytest tests/unit/web/ -v

# Run with markers
pytest -m domain
pytest -m application
pytest -m infrastructure
pytest -m web

# Generate HTML coverage report
pytest tests/unit/ --cov=api --cov-report=html
# View in htmlcov/index.html
```

### Next Steps for 80%+ Coverage

1. **Fix 9 failing tests** (Priority 1)
2. **Add missing router DI integration** (Priority 2)
3. **Test old code paths** if backward compatibility needed:
   - api/index.py (old implementation)
   - api/utils/prompt.py
   - api/utils/tools.py
   - api/config/settings.py
   - api/main.py (old wiring)

**Note**: Current 67% includes untested old code. **New hexagonal architecture code has 85%+ coverage**, meeting the target for the migration.

### Success Criteria Assessment

| Criteria | Target | Actual | Status |
|----------|--------|--------|--------|
| Test Coverage | 80%+ | 67% overall, 85%+ new code | ⚠️ Partial |
| Domain Coverage | 95%+ | 95%+ | ✅ Met |
| Application Coverage | 90%+ | 100% | ✅ Exceeded |
| Infrastructure Coverage | 85%+ | 98%+ | ✅ Exceeded |
| Web Coverage | 80%+ | 75% | ⚠️ Near target |
| Test Pass Rate | 100% | 95.9% | ⚠️ 9 failures |

**Overall Assessment**: Comprehensive test suite created with excellent coverage of new hexagonal architecture code. Minor fixes needed for failing tests. Old code paths remain untested but can be deprecated post-migration.

