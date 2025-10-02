# Hexagonal Architecture Testing Strategy - Summary

**Date Created**: 2025-10-02
**Author**: Python Test Expert (via Claude Code)
**For**: Fran
**Project**: Next.js + FastAPI Hybrid App - Hexagonal Architecture Migration

---

## Overview

Comprehensive unit testing strategy designed for the hexagonal architecture migration of the FastAPI backend. This strategy focuses on achieving **80%+ code coverage** through well-isolated unit tests using pytest and modern Python testing patterns.

---

## Documentation Delivered

### 1. **Main Strategy Document**
📄 **File**: `.claude/doc/hexagonal_migration/unit_testing_strategy.md` (38KB)

**Contents**:
- Complete test directory structure
- Pytest configuration (pytest.ini)
- Layer-by-layer testing approach
- 5 concrete code examples:
  - Domain entity test (`test_message_entity.py`)
  - Use case test with mocked ports (`test_stream_chat_completion_use_case.py`)
  - Infrastructure adapter test (`test_openai_llm_adapter.py`)
  - Web router test (`test_chat_router.py`)
  - Mapper test (`test_message_mapper.py`)
- Async testing patterns
- Coverage best practices
- Common pitfalls to avoid

### 2. **Quick Reference Guide**
📄 **File**: `.claude/doc/hexagonal_migration/testing_quick_reference.md` (11KB)

**Contents**:
- Common testing patterns cheat sheet
- Mock patterns (Mock, AsyncMock, patch)
- Assertion examples
- Running tests commands
- Coverage commands
- Troubleshooting guide
- Test file template

### 3. **Configuration Templates**
📄 **Files**:
- `pytest.ini.template` - Ready-to-use pytest configuration
- `requirements-test.txt.template` - Test dependencies list

---

## Test Structure Designed

```
tests/
├── conftest.py                              # Shared fixtures
├── pytest.ini                               # Pytest config (use template)
│
├── unit/
│   ├── domain/
│   │   ├── test_message_entity.py          # Message entity tests
│   │   ├── test_tool_call_entity.py        # ToolCall entity tests
│   │   ├── test_stream_chunk_entity.py     # StreamChunk tests
│   │   ├── test_value_objects.py           # Enums, UsageStats tests
│   │   └── test_domain_exceptions.py       # Exception tests
│   │
│   ├── application/
│   │   ├── test_stream_chat_completion_use_case.py
│   │   ├── test_execute_tool_use_case.py
│   │   └── test_convert_messages_use_case.py
│   │
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   ├── test_openai_llm_adapter.py
│   │   │   ├── test_open_meteo_weather_adapter.py
│   │   │   ├── test_in_memory_tool_repository.py
│   │   │   └── test_vercel_stream_protocol_adapter.py
│   │   └── test_di_container.py
│   │
│   └── web/
│       ├── test_chat_router.py             # FastAPI endpoint tests
│       ├── test_message_mapper.py          # DTO ↔ Domain mapping
│       ├── test_stream_chunk_mapper.py
│       └── test_dependencies.py
│
└── fixtures/
    ├── domain_fixtures.py                   # Domain test data
    ├── openai_fixtures.py                   # OpenAI mock responses
    └── request_fixtures.py                  # HTTP request fixtures
```

---

## Key Testing Patterns by Layer

### 1. Domain Layer (95%+ coverage target)
**What to test**:
- Entity creation and validation
- Business rule enforcement
- Immutability (frozen dataclasses)
- Domain exception raising
- Value object equality

**Testing approach**:
- Direct instantiation (no mocking needed)
- Use `@pytest.mark.parametrize` for edge cases
- Test `__post_init__` validation thoroughly
- Verify frozen dataclass behavior

**Example**:
```python
def test_message_with_tool_role_requires_tool_call_id():
    with pytest.raises(InvalidMessageError, match="tool_call_id required"):
        Message(role=MessageRole.TOOL, content="Result", tool_call_id=None)
```

---

### 2. Application Layer (90%+ coverage target)
**What to test**:
- Use case orchestration logic
- Port interaction (mocked)
- Async generator streaming
- Error handling and propagation
- Tool execution flow

**Testing approach**:
- Mock all ports using `AsyncMock(spec=IPort)`
- Test the single `execute()` method
- Verify repository method calls
- Test both happy and error paths

**Example**:
```python
@pytest.mark.asyncio
async def test_execute_streams_text_chunks(use_case, mock_llm_provider):
    async def mock_stream():
        yield StreamChunk(type=ChunkType.TEXT, content="Hello")

    mock_llm_provider.stream_chat_completion.return_value = mock_stream()

    chunks = [chunk async for chunk in use_case.execute(messages)]

    assert len(chunks) == 1
    mock_llm_provider.stream_chat_completion.assert_called_once()
```

---

### 3. Infrastructure Layer (85%+ coverage target)
**What to test**:
- External service integration (mocked)
- Data transformation (domain ↔ external format)
- Error handling (API errors, timeouts)
- Protocol encoding/decoding

**Testing approach**:
- Mock external clients (OpenAI, httpx)
- Use `unittest.mock.patch` for external dependencies
- Test data format conversions
- Test error scenarios (rate limits, network errors)

**Example**:
```python
@pytest.mark.asyncio
async def test_openai_adapter_handles_api_error(adapter, mock_client):
    from openai import APIError
    mock_client.chat.completions.create.side_effect = APIError(
        message="Rate limit", request=MagicMock(), body={}
    )

    with pytest.raises(ChatCompletionError, match="Rate limit"):
        async for _ in adapter.stream_chat_completion(messages):
            pass
```

---

### 4. Web Layer (80%+ coverage target)
**What to test**:
- HTTP endpoint status codes
- Request validation (Pydantic)
- Response serialization
- Streaming responses
- DTO ↔ Domain mapping
- Dependency injection

**Testing approach**:
- Use `FastAPI.TestClient`
- Override dependencies with mocks
- Test streaming endpoints
- Validate DTO schemas

**Example**:
```python
def test_post_chat_returns_streaming_response(client, mock_use_case):
    async def mock_stream():
        yield StreamChunk(type=ChunkType.TEXT, content="Hello")

    mock_use_case.execute.return_value = mock_stream()

    response = client.post("/api/chat", json={"messages": [...]})

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream"
```

---

## Test Dependencies Required

Add to `requirements.txt`:
```txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-mock==3.12.0
pytest-env==1.1.3
faker==20.1.0
freezegun==1.4.0
```

Optional but recommended:
```txt
pytest-xdist==3.5.0          # Parallel test execution
pytest-timeout==2.2.0        # Test timeouts
pytest-randomly==3.15.0      # Randomize test order
```

---

## Running Tests

```bash
# Run all tests with coverage
pytest

# Run specific layer
pytest -m domain
pytest -m application
pytest -m infrastructure
pytest -m web

# Run with HTML coverage report
pytest --cov=api --cov-report=html
open htmlcov/index.html

# Run in parallel (after installing pytest-xdist)
pytest -n auto

# Run only fast tests
pytest -m "unit and not slow"

# Verbose output
pytest -v

# Stop on first failure
pytest -x
```

---

## Coverage Targets by Layer

| Layer | Target | Focus Areas |
|-------|--------|-------------|
| **Domain** | 95%+ | Entities, value objects, validation, business rules |
| **Application** | 90%+ | Use case orchestration, error handling |
| **Infrastructure** | 85%+ | Adapter implementations, protocol encoding |
| **Web** | 80%+ | Routers, DTOs, mappers, dependency injection |
| **Overall** | 80%+ | Entire `api/` codebase |

---

## Async Testing Patterns

### Pattern 1: Testing Async Generators
```python
@pytest.mark.asyncio
async def test_async_generator():
    chunks = []
    async for chunk in async_generator_function():
        chunks.append(chunk)
    assert len(chunks) == expected_count
```

### Pattern 2: Mocking Async Methods
```python
mock_service = AsyncMock()
mock_service.fetch_data.return_value = "result"
result = await mock_service.fetch_data()
assert result == "result"
```

### Pattern 3: Creating Async Generator Mocks
```python
async def mock_stream():
    yield item1
    yield item2

mock_provider.stream.return_value = mock_stream()
```

---

## Common Mocking Patterns

### Mock Port Interface
```python
@pytest.fixture
def mock_llm_provider():
    return AsyncMock(spec=ILLMProvider)
```

### Mock External HTTP Client
```python
with patch("httpx.AsyncClient.get", return_value=mock_response):
    result = await adapter.fetch_data()
```

### Mock OpenAI Client
```python
@pytest.fixture
def mock_openai_client():
    client = MagicMock()
    client.chat.completions.create = AsyncMock()
    return client
```

### Override FastAPI Dependency
```python
async def override_dependency():
    return mock_instance

app.dependency_overrides[get_original] = override_dependency
```

---

## Best Practices Defined

### ✅ DO
- Follow AAA pattern (Arrange-Act-Assert)
- Use descriptive test names: `test_<method>_<scenario>_<expected_result>`
- Mock at architectural boundaries (ports)
- Test both happy and error paths
- Use parametrized tests for multiple scenarios
- Organize fixtures in conftest.py
- Use proper async mocking (`AsyncMock`)
- Test streaming with async generators
- Verify mock calls with assertions

### ❌ DON'T
- Test implementation details
- Mock what you don't own (create adapters instead)
- Create test interdependencies
- Use real external services
- Skip edge cases (None, empty lists, boundaries)
- Ignore async/await in tests
- Batch multiple assertions without context
- Use time.sleep in async tests (use freezegun)

---

## Next Steps for Implementation

### Phase 1: Setup (15 min)
1. Copy `pytest.ini.template` to project root as `pytest.ini`
2. Add test dependencies to `requirements.txt`
3. Run `pip install -r requirements.txt`
4. Create `tests/` directory structure

### Phase 2: Start with Domain Layer (1-2 hours)
1. Create `tests/unit/domain/test_message_entity.py`
2. Test entity creation and validation
3. Add parametrized tests for edge cases
4. Verify 95%+ coverage for domain layer

### Phase 3: Application Layer (2-3 hours)
1. Create use case tests with mocked ports
2. Test async generator streaming
3. Test error handling
4. Verify 90%+ coverage

### Phase 4: Infrastructure Layer (2-3 hours)
1. Mock OpenAI client responses
2. Mock HTTP calls for weather service
3. Test protocol adapter encoding
4. Verify 85%+ coverage

### Phase 5: Web Layer (2-3 hours)
1. Set up FastAPI TestClient
2. Test endpoints with dependency overrides
3. Test DTOs and mappers
4. Verify 80%+ coverage

### Phase 6: Continuous Coverage (ongoing)
1. Run tests on every code change
2. Review coverage reports
3. Add tests for uncovered paths
4. Maintain 80%+ overall coverage

---

## Troubleshooting Guide

| Issue | Solution |
|-------|----------|
| "Event loop is closed" | Use `@pytest.mark.asyncio` and `asyncio_mode = auto` in pytest.ini |
| Mock not called | Check import path (mock where used, not where defined) |
| "coroutine was never awaited" | Use `AsyncMock` for async methods |
| Fixture not found | Ensure conftest.py is in test directory or parent |
| Tests pass alone, fail together | Shared state - ensure proper isolation and teardown |
| Coverage not calculated | Ensure `--cov=api` points to correct source directory |

---

## Summary

This comprehensive testing strategy provides:
- ✅ **Complete test structure** for all layers
- ✅ **5 concrete code examples** ready to adapt
- ✅ **Pytest configuration** optimized for hexagonal architecture
- ✅ **Async testing patterns** for streaming use cases
- ✅ **Mocking strategies** for ports, adapters, and external services
- ✅ **FastAPI TestClient patterns** for web layer
- ✅ **Coverage targets** by layer (80%+ overall)
- ✅ **Quick reference guide** for common patterns
- ✅ **Best practices** and anti-patterns
- ✅ **Troubleshooting guide** for common issues

The strategy is designed specifically for pytest with hexagonal architecture, focusing on proper isolation, async testing, and dependency mocking at architectural boundaries.

---

## Additional Resources

- **Main Strategy**: `.claude/doc/hexagonal_migration/unit_testing_strategy.md`
- **Quick Reference**: `.claude/doc/hexagonal_migration/testing_quick_reference.md`
- **Pytest Config Template**: `.claude/doc/hexagonal_migration/pytest.ini.template`
- **Test Dependencies**: `.claude/doc/hexagonal_migration/requirements-test.txt.template`

All examples are production-ready and follow pytest best practices for hexagonal architecture testing.
