# Testing Quick Reference Guide

## Common Testing Patterns Cheat Sheet

### 1. Basic Test Structure (AAA Pattern)

```python
def test_feature_name_scenario_expected_result():
    # Arrange - Set up test data
    input_data = create_test_data()

    # Act - Execute the code under test
    result = function_under_test(input_data)

    # Assert - Verify expected outcome
    assert result == expected_value
```

---

### 2. Async Test Pattern

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    # Arrange
    async_service = AsyncServiceMock()

    # Act
    result = await async_service.fetch_data()

    # Assert
    assert result is not None
```

---

### 3. Mocking Port Interfaces

```python
from unittest.mock import AsyncMock, Mock

@pytest.fixture
def mock_llm_provider():
    """Mock ILLMProvider port."""
    provider = AsyncMock(spec=ILLMProvider)
    provider.stream_chat_completion.return_value = mock_async_generator()
    return provider

# Usage in test
async def test_use_case(mock_llm_provider):
    use_case = UseCase(llm_provider=mock_llm_provider)
    await use_case.execute()
    mock_llm_provider.stream_chat_completion.assert_called_once()
```

---

### 4. Testing Async Generators

```python
@pytest.mark.asyncio
async def test_streaming_use_case():
    # Arrange
    async def mock_stream():
        yield Chunk(type="text", content="Hello")
        yield Chunk(type="finish")

    mock_provider.stream.return_value = mock_stream()

    # Act
    chunks = []
    async for chunk in use_case.execute():
        chunks.append(chunk)

    # Assert
    assert len(chunks) == 2
    assert chunks[0].type == "text"
```

---

### 5. Parametrized Tests

```python
@pytest.mark.parametrize("input,expected", [
    ("user", MessageRole.USER),
    ("assistant", MessageRole.ASSISTANT),
    ("system", MessageRole.SYSTEM),
])
def test_role_conversion(input, expected):
    result = convert_role(input)
    assert result == expected
```

---

### 6. Testing Exceptions

```python
def test_function_raises_error_on_invalid_input():
    with pytest.raises(ValidationError, match="Invalid input"):
        validate_input(invalid_data)
```

---

### 7. FastAPI Router Testing

```python
from fastapi.testclient import TestClient

def test_endpoint_returns_200(client: TestClient, mock_use_case):
    # Arrange
    payload = {"messages": [{"role": "user", "content": "Hi"}]}

    # Act
    response = client.post("/api/chat", json=payload)

    # Assert
    assert response.status_code == 200
    assert "content-type" in response.headers
```

---

### 8. Dependency Override Pattern

```python
@pytest.fixture
def client(app, mock_use_case):
    """TestClient with overridden dependencies."""
    async def override_dependency():
        return mock_use_case

    app.dependency_overrides[get_use_case] = override_dependency

    with TestClient(app) as client:
        yield client
```

---

### 9. Mocking External HTTP Calls

```python
from unittest.mock import patch, MagicMock

@pytest.mark.asyncio
async def test_weather_adapter():
    # Arrange
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"temp": 22.5}

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        # Act
        result = await weather_adapter.get_weather(lat=51.5, lon=-0.1)

        # Assert
        assert result["temp"] == 22.5
```

---

### 10. Mocking OpenAI Streaming Response

```python
from openai.types.chat import ChatCompletionChunk
from openai.types.chat.chat_completion_chunk import Choice, ChoiceDelta

async def mock_openai_stream():
    yield ChatCompletionChunk(
        id="chunk_1",
        choices=[Choice(
            index=0,
            delta=ChoiceDelta(content="Hello"),
            finish_reason=None
        )],
        model="gpt-4o",
        object="chat.completion.chunk"
    )

mock_openai_client.chat.completions.create.return_value = mock_openai_stream()
```

---

### 11. Fixture Organization

```python
# conftest.py
import pytest

@pytest.fixture
def sample_message():
    """Reusable message fixture."""
    return Message(role=MessageRole.USER, content="Test")

@pytest.fixture
def message_builder():
    """Factory fixture for creating messages with overrides."""
    def _build(**overrides):
        defaults = {"role": MessageRole.USER, "content": "Test"}
        return Message(**{**defaults, **overrides})
    return _build

# Usage
def test_with_fixture(message_builder):
    msg = message_builder(content="Custom content")
    assert msg.content == "Custom content"
```

---

### 12. Testing Data Transformation

```python
def test_mapper_domain_to_dto():
    # Arrange
    domain_entity = Message(role=MessageRole.USER, content="Hello")

    # Act
    dto = MessageMapper.to_dto(domain_entity)

    # Assert
    assert dto["role"] == "user"
    assert dto["content"] == "Hello"
```

---

## Common Assertions

```python
# Equality
assert result == expected

# Identity
assert result is None
assert result is not None

# Membership
assert "key" in result_dict
assert item in result_list

# Type checking
assert isinstance(result, Message)

# Exceptions
with pytest.raises(ValueError):
    function_that_raises()

with pytest.raises(ValueError, match="specific message"):
    function_that_raises()

# Async mock assertions
mock.method.assert_called_once()
mock.method.assert_called_once_with(arg1="value")
mock.method.assert_called_with(arg1="value")
mock.method.assert_not_called()
assert mock.method.call_count == 2
```

---

## Running Tests

```bash
# All tests
pytest

# Specific file
pytest tests/unit/domain/test_message_entity.py

# Specific test
pytest tests/unit/domain/test_message_entity.py::TestMessageEntity::test_create_user_message

# With coverage
pytest --cov=api --cov-report=html

# By marker
pytest -m unit
pytest -m domain
pytest -m "not slow"

# Verbose
pytest -v

# Show print statements
pytest -s

# Stop on first failure
pytest -x

# Run last failed tests
pytest --lf
```

---

## Coverage Commands

```bash
# Generate HTML coverage report
pytest --cov=api --cov-report=html
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux

# Terminal coverage report
pytest --cov=api --cov-report=term-missing

# Fail if coverage below threshold
pytest --cov=api --cov-fail-under=80
```

---

## Mock Cheat Sheet

```python
from unittest.mock import Mock, AsyncMock, MagicMock, patch

# Basic mock
mock = Mock()
mock.method.return_value = "result"
mock.method()  # Returns "result"

# Async mock
async_mock = AsyncMock()
async_mock.method.return_value = "result"
await async_mock.method()  # Returns "result"

# Side effects (multiple returns)
mock.method.side_effect = ["first", "second", "third"]
mock.method()  # Returns "first"
mock.method()  # Returns "second"

# Raise exception
mock.method.side_effect = ValueError("Error message")

# Patch decorator
@patch('module.external_function')
def test_function(mock_external):
    mock_external.return_value = "mocked"
    result = function_under_test()
    assert result == "mocked"

# Patch context manager
def test_function():
    with patch('module.external_function') as mock_external:
        mock_external.return_value = "mocked"
        result = function_under_test()
        assert result == "mocked"

# Spec (strict mocking)
mock = Mock(spec=SomeClass)  # Only allows methods that exist on SomeClass
```

---

## Pytest Markers

```python
# Mark test as slow
@pytest.mark.slow
def test_slow_operation():
    pass

# Mark as unit test
@pytest.mark.unit
def test_unit():
    pass

# Mark as async
@pytest.mark.asyncio
async def test_async():
    pass

# Skip test
@pytest.mark.skip(reason="Not implemented yet")
def test_future_feature():
    pass

# Skip if condition
@pytest.mark.skipif(sys.version_info < (3, 10), reason="Requires Python 3.10+")
def test_new_syntax():
    pass

# Expected failure
@pytest.mark.xfail
def test_known_bug():
    pass
```

---

## Common Test Scenarios by Layer

### Domain Layer
- ✅ Entity creation with valid data
- ✅ Entity validation failures
- ✅ Immutability (frozen dataclass)
- ✅ Business rule enforcement
- ✅ Value object equality
- ✅ Enum conversions

### Application Layer (Use Cases)
- ✅ Successful execution path
- ✅ Error handling from ports
- ✅ Async generator streaming
- ✅ Tool execution orchestration
- ✅ Multiple repository interactions
- ✅ Transaction boundaries

### Infrastructure Layer
- ✅ External API successful calls
- ✅ External API error handling
- ✅ Data transformation (domain ↔ external)
- ✅ Connection failures
- ✅ Retry logic
- ✅ Protocol encoding/decoding

### Web Layer
- ✅ Endpoint returns correct status code
- ✅ Request validation
- ✅ Response serialization
- ✅ Streaming responses
- ✅ DTO validation
- ✅ Mapper conversions
- ✅ Dependency injection overrides

---

## Test File Template

```python
# ABOUTME: Unit tests for [module/class name]
# ABOUTME: Tests [brief description of what's being tested]

import pytest
from unittest.mock import AsyncMock, Mock

from api.domain.entities.your_entity import YourEntity
from api.domain.exceptions import YourException


@pytest.fixture
def sample_entity():
    """Create sample entity for testing."""
    return YourEntity(field="value")


class TestYourEntity:
    """Tests for YourEntity."""

    def test_create_entity_successfully(self):
        """Test creating entity with valid data."""
        # Arrange
        data = {"field": "value"}

        # Act
        entity = YourEntity(**data)

        # Assert
        assert entity.field == "value"

    def test_validation_raises_error(self):
        """Test that validation catches invalid data."""
        # Arrange & Act & Assert
        with pytest.raises(YourException, match="Invalid"):
            YourEntity(field=None)

    @pytest.mark.parametrize("input,expected", [
        ("value1", "result1"),
        ("value2", "result2"),
    ])
    def test_method_with_various_inputs(self, input, expected):
        """Test method with parametrized inputs."""
        entity = YourEntity(field=input)
        result = entity.method()
        assert result == expected
```

---

## Troubleshooting

### Issue: "Event loop is closed"
**Solution**: Use `@pytest.mark.asyncio` and ensure `asyncio_mode = auto` in pytest.ini

### Issue: Mock not being called
**Solution**: Check if you're mocking the right import path (where it's used, not where it's defined)

### Issue: "coroutine was never awaited"
**Solution**: Use `AsyncMock` instead of `Mock` for async methods, and `await` the call

### Issue: Fixture not found
**Solution**: Ensure conftest.py is in test directory or parent, check fixture scope

### Issue: Tests pass individually but fail together
**Solution**: Tests have shared state - ensure proper teardown and isolation
