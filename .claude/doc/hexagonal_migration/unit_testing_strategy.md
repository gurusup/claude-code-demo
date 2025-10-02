# Unit Testing Strategy for Hexagonal Architecture Migration

## Overview

This document provides a comprehensive unit testing strategy for the FastAPI backend hexagonal architecture migration. The goal is to achieve **80%+ coverage** using pytest with proper isolation and mocking patterns.

---

## 1. Test File Structure

```
tests/
├── conftest.py                              # Shared fixtures and configuration
├── pytest.ini                               # Pytest configuration (root level)
│
├── unit/                                    # All unit tests
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── test_message_entity.py
│   │   ├── test_tool_call_entity.py
│   │   ├── test_stream_chunk_entity.py
│   │   ├── test_value_objects.py
│   │   └── test_domain_exceptions.py
│   │
│   ├── application/
│   │   ├── __init__.py
│   │   ├── test_stream_chat_completion_use_case.py
│   │   ├── test_execute_tool_use_case.py
│   │   └── test_convert_messages_use_case.py
│   │
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── adapters/
│   │   │   ├── test_openai_llm_adapter.py
│   │   │   ├── test_open_meteo_weather_adapter.py
│   │   │   ├── test_in_memory_tool_repository.py
│   │   │   └── test_vercel_stream_protocol_adapter.py
│   │   └── test_di_container.py
│   │
│   └── web/
│       ├── __init__.py
│       ├── test_chat_router.py
│       ├── test_message_mapper.py
│       ├── test_stream_chunk_mapper.py
│       └── test_dependencies.py
│
└── fixtures/                                # Reusable test data
    ├── __init__.py
    ├── domain_fixtures.py
    ├── openai_fixtures.py
    └── request_fixtures.py
```

---

## 2. Pytest Configuration

### `pytest.ini` (root level)

```ini
[tool:pytest]
# Test discovery
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Output and reporting
addopts =
    -v
    --strict-markers
    --tb=short
    --cov=api
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=80
    --asyncio-mode=auto

# Markers
markers =
    unit: Unit tests (fast, isolated)
    slow: Slow running tests
    asyncio: Async tests
    domain: Domain layer tests
    application: Application layer tests
    infrastructure: Infrastructure layer tests
    web: Web layer tests

# Asyncio configuration
asyncio_mode = auto

# Coverage configuration
[coverage:run]
source = api
omit =
    */tests/*
    */conftest.py
    */__init__.py

[coverage:report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
    if TYPE_CHECKING:
    @abstractmethod
```

---

## 3. Test Dependencies

### Add to `requirements.txt`:

```txt
# Testing dependencies
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-mock==3.12.0
pytest-env==1.1.3
httpx==0.27.0  # Already included, used for FastAPI TestClient
faker==20.1.0  # For generating test data
freezegun==1.4.0  # For time-based testing
```

---

## 4. Domain Layer Testing

### Example: Testing Domain Entity

**File: `tests/unit/domain/test_message_entity.py`**

```python
# ABOUTME: Unit tests for domain Message entity
# ABOUTME: Tests validation, business rules, and state transitions

import pytest
from dataclasses import FrozenInstanceError
from api.domain.entities.message import Message, MessageRole
from api.domain.entities.tool_call import ToolCall
from api.domain.exceptions import InvalidMessageError


class TestMessageEntity:
    """Tests for Message domain entity."""

    def test_create_user_message_successfully(self):
        """Test creating a valid user message."""
        # Arrange & Act
        message = Message(
            role=MessageRole.USER,
            content="Hello, AI!"
        )

        # Assert
        assert message.role == MessageRole.USER
        assert message.content == "Hello, AI!"
        assert message.tool_calls == []
        assert message.tool_call_id is None

    def test_create_assistant_message_with_tool_calls(self):
        """Test creating assistant message with tool calls."""
        # Arrange
        tool_call = ToolCall(
            id="call_123",
            name="get_weather",
            arguments='{"city": "London"}'
        )

        # Act
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Let me check the weather.",
            tool_calls=[tool_call]
        )

        # Assert
        assert message.role == MessageRole.ASSISTANT
        assert len(message.tool_calls) == 1
        assert message.tool_calls[0].name == "get_weather"

    def test_tool_message_requires_tool_call_id(self):
        """Test that tool messages must have tool_call_id."""
        # Arrange & Act & Assert
        with pytest.raises(InvalidMessageError, match="tool_call_id required"):
            Message(
                role=MessageRole.TOOL,
                content="Weather data",
                tool_call_id=None  # Invalid!
            )

    def test_user_message_cannot_have_tool_calls(self):
        """Test that user messages cannot have tool calls."""
        # Arrange
        tool_call = ToolCall(id="call_123", name="test", arguments="{}")

        # Act & Assert
        with pytest.raises(InvalidMessageError, match="User messages cannot have tool calls"):
            Message(
                role=MessageRole.USER,
                content="Hello",
                tool_calls=[tool_call]
            )

    def test_message_is_immutable(self):
        """Test that Message is immutable (frozen dataclass)."""
        # Arrange
        message = Message(role=MessageRole.USER, content="Test")

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            message.content = "Modified"

    @pytest.mark.parametrize("role,content,tool_call_id,tool_calls,should_raise", [
        (MessageRole.USER, "Hello", None, [], False),
        (MessageRole.ASSISTANT, "Response", None, [], False),
        (MessageRole.TOOL, "Result", "call_123", [], False),
        (MessageRole.TOOL, "Result", None, [], True),  # Missing tool_call_id
        (MessageRole.SYSTEM, "", None, [], True),  # Empty content
    ])
    def test_message_validation_parametrized(
        self, role, content, tool_call_id, tool_calls, should_raise
    ):
        """Parametrized test for message validation rules."""
        if should_raise:
            with pytest.raises(InvalidMessageError):
                Message(
                    role=role,
                    content=content,
                    tool_call_id=tool_call_id,
                    tool_calls=tool_calls
                )
        else:
            message = Message(
                role=role,
                content=content,
                tool_call_id=tool_call_id,
                tool_calls=tool_calls
            )
            assert message.role == role
```

### Example: Testing Value Objects

**File: `tests/unit/domain/test_value_objects.py`**

```python
# ABOUTME: Unit tests for domain value objects
# ABOUTME: Tests enums, usage stats, and immutable value types

import pytest
from api.domain.value_objects import (
    MessageRole,
    ToolInvocationState,
    UsageStats
)


class TestMessageRoleEnum:
    """Tests for MessageRole enum."""

    def test_all_roles_exist(self):
        """Test that all expected roles are defined."""
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"
        assert MessageRole.TOOL.value == "tool"

    def test_from_string(self):
        """Test creating role from string value."""
        role = MessageRole("assistant")
        assert role == MessageRole.ASSISTANT


class TestUsageStats:
    """Tests for UsageStats value object."""

    def test_create_usage_stats(self):
        """Test creating usage stats."""
        stats = UsageStats(
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150
        )

        assert stats.prompt_tokens == 100
        assert stats.completion_tokens == 50
        assert stats.total_tokens == 150

    def test_usage_stats_validation(self):
        """Test that usage stats validates positive values."""
        with pytest.raises(ValueError, match="must be positive"):
            UsageStats(
                prompt_tokens=-10,
                completion_tokens=50,
                total_tokens=40
            )

    def test_usage_stats_total_calculation(self):
        """Test automatic total calculation if not provided."""
        stats = UsageStats(
            prompt_tokens=100,
            completion_tokens=50
        )

        assert stats.total_tokens == 150
```

---

## 5. Application Layer Testing (Use Cases)

### Example: Testing Use Case with Mocked Ports

**File: `tests/unit/application/test_stream_chat_completion_use_case.py`**

```python
# ABOUTME: Unit tests for StreamChatCompletionUseCase
# ABOUTME: Tests async generator orchestration with mocked ports

import pytest
from unittest.mock import AsyncMock, Mock, MagicMock
from typing import AsyncGenerator

from api.application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from api.domain.entities.message import Message, MessageRole
from api.domain.entities.stream_chunk import StreamChunk, ChunkType
from api.domain.entities.tool_call import ToolCall
from api.domain.ports.llm_provider import ILLMProvider
from api.domain.ports.tool_repository import IToolRepository
from api.domain.exceptions import ChatCompletionError


@pytest.fixture
def mock_llm_provider():
    """Mock LLM provider port."""
    provider = AsyncMock(spec=ILLMProvider)
    return provider


@pytest.fixture
def mock_tool_repository():
    """Mock tool repository port."""
    repo = Mock(spec=IToolRepository)
    return repo


@pytest.fixture
def use_case(mock_llm_provider, mock_tool_repository):
    """Create use case instance with mocked dependencies."""
    return StreamChatCompletionUseCase(
        llm_provider=mock_llm_provider,
        tool_repository=mock_tool_repository
    )


class TestStreamChatCompletionUseCase:
    """Tests for StreamChatCompletionUseCase."""

    @pytest.mark.asyncio
    async def test_execute_simple_text_streaming(self, use_case, mock_llm_provider):
        """Test streaming simple text response without tools."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Hello")]

        async def mock_stream():
            yield StreamChunk(type=ChunkType.TEXT, content="Hello")
            yield StreamChunk(type=ChunkType.TEXT, content=" world")
            yield StreamChunk(type=ChunkType.FINISH, usage={"prompt_tokens": 10})

        mock_llm_provider.stream_chat_completion.return_value = mock_stream()

        # Act
        chunks = []
        async for chunk in use_case.execute(messages=messages):
            chunks.append(chunk)

        # Assert
        assert len(chunks) == 3
        assert chunks[0].content == "Hello"
        assert chunks[1].content == " world"
        assert chunks[2].type == ChunkType.FINISH
        mock_llm_provider.stream_chat_completion.assert_called_once_with(
            messages=messages,
            tools=None
        )

    @pytest.mark.asyncio
    async def test_execute_with_tool_call_and_execution(
        self, use_case, mock_llm_provider, mock_tool_repository
    ):
        """Test streaming with tool call invocation and execution."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="What's the weather?")]

        async def mock_stream():
            yield StreamChunk(
                type=ChunkType.TOOL_CALL,
                tool_call=ToolCall(
                    id="call_123",
                    name="get_weather",
                    arguments='{"city": "London"}'
                )
            )
            yield StreamChunk(type=ChunkType.FINISH, usage={"prompt_tokens": 15})

        mock_llm_provider.stream_chat_completion.return_value = mock_stream()

        # Mock tool execution
        mock_tool = AsyncMock()
        mock_tool.execute.return_value = "Sunny, 22°C"
        mock_tool_repository.get_tool.return_value = mock_tool

        # Act
        chunks = []
        async for chunk in use_case.execute(messages=messages):
            chunks.append(chunk)

        # Assert
        assert len(chunks) == 3  # tool_call + tool_result + finish
        assert chunks[0].type == ChunkType.TOOL_CALL
        assert chunks[1].type == ChunkType.TOOL_RESULT
        assert chunks[1].content == "Sunny, 22°C"

        mock_tool_repository.get_tool.assert_called_once_with("get_weather")
        mock_tool.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_handles_llm_provider_error(self, use_case, mock_llm_provider):
        """Test that LLM provider errors are properly raised."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Test")]

        async def mock_stream_with_error():
            if False:  # Make this an async generator
                yield
            raise ChatCompletionError("API connection failed")

        mock_llm_provider.stream_chat_completion.return_value = mock_stream_with_error()

        # Act & Assert
        with pytest.raises(ChatCompletionError, match="API connection failed"):
            async for _ in use_case.execute(messages=messages):
                pass

    @pytest.mark.asyncio
    async def test_execute_handles_tool_execution_error(
        self, use_case, mock_llm_provider, mock_tool_repository
    ):
        """Test handling of tool execution errors."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Weather?")]

        async def mock_stream():
            yield StreamChunk(
                type=ChunkType.TOOL_CALL,
                tool_call=ToolCall(id="call_123", name="get_weather", arguments="{}")
            )

        mock_llm_provider.stream_chat_completion.return_value = mock_stream()

        # Mock tool that raises error
        mock_tool = AsyncMock()
        mock_tool.execute.side_effect = Exception("Weather API down")
        mock_tool_repository.get_tool.return_value = mock_tool

        # Act
        chunks = []
        async for chunk in use_case.execute(messages=messages):
            chunks.append(chunk)

        # Assert - should yield error chunk instead of crashing
        assert any(chunk.type == ChunkType.ERROR for chunk in chunks)
        error_chunk = next(c for c in chunks if c.type == ChunkType.ERROR)
        assert "Weather API down" in error_chunk.content
```

---

## 6. Infrastructure Layer Testing

### Example: Testing OpenAI Adapter

**File: `tests/unit/infrastructure/adapters/test_openai_llm_adapter.py`**

```python
# ABOUTME: Unit tests for OpenAI LLM adapter
# ABOUTME: Tests streaming chunks, tool calls, and error handling with mocked OpenAI client

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from openai.types.chat import ChatCompletion, ChatCompletionChunk
from openai.types.chat.chat_completion_chunk import Choice, ChoiceDelta

from api.infrastructure.adapters.openai_llm_adapter import OpenAILLMAdapter
from api.domain.entities.message import Message, MessageRole
from api.domain.entities.stream_chunk import ChunkType
from api.domain.exceptions import ChatCompletionError


@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client."""
    client = MagicMock()
    client.chat.completions.create = AsyncMock()
    return client


@pytest.fixture
def adapter(mock_openai_client):
    """Create adapter with mocked OpenAI client."""
    return OpenAILLMAdapter(client=mock_openai_client, model="gpt-4o")


class TestOpenAILLMAdapter:
    """Tests for OpenAI LLM adapter."""

    @pytest.mark.asyncio
    async def test_stream_chat_completion_text_chunks(self, adapter, mock_openai_client):
        """Test streaming text chunks from OpenAI."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Hello")]

        # Mock OpenAI streaming response
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
            yield ChatCompletionChunk(
                id="chunk_2",
                choices=[Choice(
                    index=0,
                    delta=ChoiceDelta(content=" world"),
                    finish_reason=None
                )],
                model="gpt-4o",
                object="chat.completion.chunk"
            )
            yield ChatCompletionChunk(
                id="chunk_3",
                choices=[Choice(
                    index=0,
                    delta=ChoiceDelta(),
                    finish_reason="stop"
                )],
                model="gpt-4o",
                object="chat.completion.chunk",
                usage={"prompt_tokens": 10, "completion_tokens": 5}
            )

        mock_openai_client.chat.completions.create.return_value = mock_openai_stream()

        # Act
        chunks = []
        async for chunk in adapter.stream_chat_completion(messages=messages):
            chunks.append(chunk)

        # Assert
        assert len(chunks) == 3
        assert chunks[0].type == ChunkType.TEXT
        assert chunks[0].content == "Hello"
        assert chunks[1].content == " world"
        assert chunks[2].type == ChunkType.FINISH

        # Verify OpenAI client was called correctly
        mock_openai_client.chat.completions.create.assert_called_once()
        call_kwargs = mock_openai_client.chat.completions.create.call_args.kwargs
        assert call_kwargs["model"] == "gpt-4o"
        assert call_kwargs["stream"] is True
        assert len(call_kwargs["messages"]) == 1

    @pytest.mark.asyncio
    async def test_stream_chat_completion_with_tool_call(self, adapter, mock_openai_client):
        """Test streaming tool call chunks."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Weather?")]

        async def mock_openai_stream():
            yield ChatCompletionChunk(
                id="chunk_1",
                choices=[Choice(
                    index=0,
                    delta=ChoiceDelta(
                        tool_calls=[{
                            "id": "call_123",
                            "type": "function",
                            "function": {
                                "name": "get_weather",
                                "arguments": '{"city":'
                            }
                        }]
                    ),
                    finish_reason=None
                )],
                model="gpt-4o",
                object="chat.completion.chunk"
            )
            yield ChatCompletionChunk(
                id="chunk_2",
                choices=[Choice(
                    index=0,
                    delta=ChoiceDelta(
                        tool_calls=[{
                            "index": 0,
                            "function": {"arguments": ' "London"}'}
                        }]
                    ),
                    finish_reason=None
                )],
                model="gpt-4o",
                object="chat.completion.chunk"
            )

        mock_openai_client.chat.completions.create.return_value = mock_openai_stream()

        # Act
        chunks = []
        async for chunk in adapter.stream_chat_completion(messages=messages):
            chunks.append(chunk)

        # Assert
        tool_chunks = [c for c in chunks if c.type == ChunkType.TOOL_CALL]
        assert len(tool_chunks) >= 1
        assert tool_chunks[0].tool_call.name == "get_weather"

    @pytest.mark.asyncio
    async def test_stream_chat_completion_handles_api_error(self, adapter, mock_openai_client):
        """Test handling of OpenAI API errors."""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Test")]

        from openai import APIError
        mock_openai_client.chat.completions.create.side_effect = APIError(
            message="Rate limit exceeded",
            request=MagicMock(),
            body={}
        )

        # Act & Assert
        with pytest.raises(ChatCompletionError, match="Rate limit exceeded"):
            async for _ in adapter.stream_chat_completion(messages=messages):
                pass

    def test_convert_domain_message_to_openai_format(self, adapter):
        """Test message format conversion."""
        # Arrange
        domain_message = Message(
            role=MessageRole.USER,
            content="Hello AI"
        )

        # Act
        openai_message = adapter._convert_to_openai_format(domain_message)

        # Assert
        assert openai_message["role"] == "user"
        assert openai_message["content"] == "Hello AI"
```

### Example: Testing External Service Adapter

**File: `tests/unit/infrastructure/adapters/test_open_meteo_weather_adapter.py`**

```python
# ABOUTME: Unit tests for OpenMeteo weather service adapter
# ABOUTME: Tests HTTP calls, response parsing, and error handling

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from api.infrastructure.adapters.open_meteo_weather_adapter import OpenMeteoWeatherAdapter
from api.domain.exceptions import WeatherServiceError


@pytest.fixture
def adapter():
    """Create weather adapter instance."""
    return OpenMeteoWeatherAdapter(base_url="https://api.open-meteo.com/v1")


class TestOpenMeteoWeatherAdapter:
    """Tests for OpenMeteo weather adapter."""

    @pytest.mark.asyncio
    async def test_get_weather_success(self, adapter):
        """Test successful weather data retrieval."""
        # Arrange
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "current_weather": {
                "temperature": 22.5,
                "windspeed": 10.0,
                "weathercode": 0
            }
        }

        with patch("httpx.AsyncClient.get", return_value=mock_response) as mock_get:
            # Act
            result = await adapter.get_weather(latitude=51.5074, longitude=-0.1278)

            # Assert
            assert "temperature" in result
            assert result["temperature"] == 22.5
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            assert "latitude=51.5074" in str(call_args)

    @pytest.mark.asyncio
    async def test_get_weather_handles_http_error(self, adapter):
        """Test handling of HTTP errors."""
        # Arrange
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = httpx.HTTPError("Connection timeout")

            # Act & Assert
            with pytest.raises(WeatherServiceError, match="Connection timeout"):
                await adapter.get_weather(latitude=0.0, longitude=0.0)

    @pytest.mark.asyncio
    async def test_get_weather_handles_invalid_response(self, adapter):
        """Test handling of invalid JSON response."""
        # Arrange
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}  # Missing expected fields

        with patch("httpx.AsyncClient.get", return_value=mock_response):
            # Act & Assert
            with pytest.raises(WeatherServiceError, match="Invalid response format"):
                await adapter.get_weather(latitude=0.0, longitude=0.0)
```

---

## 7. Web Layer Testing

### Example: Testing FastAPI Router

**File: `tests/unit/web/test_chat_router.py`**

```python
# ABOUTME: Unit tests for chat router
# ABOUTME: Tests HTTP endpoints, streaming, and dependency injection

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from api.web.routers.chat_router import router
from api.application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from api.domain.entities.stream_chunk import StreamChunk, ChunkType
from fastapi import FastAPI


@pytest.fixture
def app():
    """Create FastAPI app with chat router."""
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def mock_use_case():
    """Mock StreamChatCompletionUseCase."""
    use_case = AsyncMock(spec=StreamChatCompletionUseCase)
    return use_case


@pytest.fixture
def client(app, mock_use_case):
    """Create test client with mocked dependencies."""
    # Override dependency
    async def override_use_case():
        return mock_use_case

    from api.web.dependencies import get_stream_chat_use_case
    app.dependency_overrides[get_stream_chat_use_case] = override_use_case

    with TestClient(app) as client:
        yield client


class TestChatRouter:
    """Tests for /api/chat endpoint."""

    def test_post_chat_returns_streaming_response(self, client, mock_use_case):
        """Test that POST /api/chat returns streaming response."""
        # Arrange
        async def mock_stream():
            yield StreamChunk(type=ChunkType.TEXT, content="Hello")
            yield StreamChunk(type=ChunkType.FINISH, usage={"prompt_tokens": 10})

        mock_use_case.execute.return_value = mock_stream()

        request_payload = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }

        # Act
        response = client.post("/api/chat", json=request_payload)

        # Assert
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        assert "x-vercel-ai-data-stream" in response.headers

        # Verify stream content
        stream_data = response.text
        assert "0:\"Hello\"" in stream_data  # Text chunk
        assert "e:" in stream_data  # Finish event

    def test_post_chat_with_invalid_payload_returns_422(self, client):
        """Test validation error for invalid request payload."""
        # Arrange
        invalid_payload = {
            "messages": "not a list"  # Should be array
        }

        # Act
        response = client.post("/api/chat", json=invalid_payload)

        # Assert
        assert response.status_code == 422

    def test_post_chat_handles_use_case_error(self, client, mock_use_case):
        """Test error handling when use case fails."""
        # Arrange
        from api.domain.exceptions import ChatCompletionError

        async def mock_stream_with_error():
            if False:
                yield
            raise ChatCompletionError("LLM provider failed")

        mock_use_case.execute.return_value = mock_stream_with_error()

        request_payload = {
            "messages": [{"role": "user", "content": "Test"}]
        }

        # Act
        response = client.post("/api/chat", json=request_payload)

        # Assert
        assert response.status_code == 500
        assert "LLM provider failed" in response.text
```

### Example: Testing Mappers

**File: `tests/unit/web/test_message_mapper.py`**

```python
# ABOUTME: Unit tests for message mappers
# ABOUTME: Tests bidirectional conversion between DTOs and domain entities

import pytest
from api.web.mappers.message_mapper import MessageMapper
from api.web.dto.client_message import ClientMessage
from api.domain.entities.message import Message, MessageRole
from api.domain.entities.tool_call import ToolCall


class TestMessageMapper:
    """Tests for MessageMapper."""

    def test_to_domain_user_message(self):
        """Test mapping ClientMessage to domain Message (user)."""
        # Arrange
        client_message = ClientMessage(
            role="user",
            content="Hello AI",
            experimental_attachments=[]
        )

        # Act
        domain_message = MessageMapper.to_domain(client_message)

        # Assert
        assert isinstance(domain_message, Message)
        assert domain_message.role == MessageRole.USER
        assert domain_message.content == "Hello AI"

    def test_to_domain_assistant_message_with_tool_calls(self):
        """Test mapping assistant message with tool calls."""
        # Arrange
        client_message = ClientMessage(
            role="assistant",
            content="Calling tool",
            tool_calls=[
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {
                        "name": "get_weather",
                        "arguments": '{"city": "London"}'
                    }
                }
            ]
        )

        # Act
        domain_message = MessageMapper.to_domain(client_message)

        # Assert
        assert len(domain_message.tool_calls) == 1
        assert domain_message.tool_calls[0].id == "call_123"
        assert domain_message.tool_calls[0].name == "get_weather"

    def test_to_dto_from_domain_message(self):
        """Test mapping domain Message back to ClientMessage."""
        # Arrange
        domain_message = Message(
            role=MessageRole.ASSISTANT,
            content="Response text"
        )

        # Act
        client_message = MessageMapper.to_dto(domain_message)

        # Assert
        assert client_message["role"] == "assistant"
        assert client_message["content"] == "Response text"

    @pytest.mark.parametrize("role_str,expected_enum", [
        ("user", MessageRole.USER),
        ("assistant", MessageRole.ASSISTANT),
        ("system", MessageRole.SYSTEM),
        ("tool", MessageRole.TOOL),
    ])
    def test_role_conversion_parametrized(self, role_str, expected_enum):
        """Test role string to enum conversion."""
        client_message = ClientMessage(role=role_str, content="Test")
        domain_message = MessageMapper.to_domain(client_message)
        assert domain_message.role == expected_enum
```

---

## 8. Shared Fixtures

### `tests/conftest.py`

```python
# ABOUTME: Global pytest fixtures and configuration
# ABOUTME: Shared fixtures for all test modules

import pytest
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

from api.domain.entities.message import Message, MessageRole
from api.domain.entities.tool_call import ToolCall
from api.domain.entities.stream_chunk import StreamChunk, ChunkType


# Domain fixtures
@pytest.fixture
def sample_user_message() -> Message:
    """Sample user message for testing."""
    return Message(
        role=MessageRole.USER,
        content="What's the weather in London?"
    )


@pytest.fixture
def sample_assistant_message() -> Message:
    """Sample assistant message for testing."""
    return Message(
        role=MessageRole.ASSISTANT,
        content="Let me check the weather for you."
    )


@pytest.fixture
def sample_tool_call() -> ToolCall:
    """Sample tool call for testing."""
    return ToolCall(
        id="call_abc123",
        name="get_weather",
        arguments='{"city": "London", "units": "celsius"}'
    )


@pytest.fixture
def sample_text_chunk() -> StreamChunk:
    """Sample text stream chunk."""
    return StreamChunk(
        type=ChunkType.TEXT,
        content="Hello world"
    )


# Async mock helpers
@pytest.fixture
def async_mock_generator():
    """Factory for creating async generator mocks."""
    async def _create_generator(items: list):
        for item in items:
            yield item
    return _create_generator


# Test data builders
@pytest.fixture
def message_builder():
    """Builder for creating test messages with defaults."""
    def _build(**overrides):
        defaults = {
            "role": MessageRole.USER,
            "content": "Test message",
            "tool_calls": [],
            "tool_call_id": None
        }
        return Message(**{**defaults, **overrides})
    return _build
```

### `tests/fixtures/openai_fixtures.py`

```python
# ABOUTME: OpenAI-specific test fixtures
# ABOUTME: Mock OpenAI responses and chunks

import pytest
from openai.types.chat import ChatCompletionChunk
from openai.types.chat.chat_completion_chunk import Choice, ChoiceDelta


@pytest.fixture
def openai_text_chunk():
    """Create OpenAI text chunk."""
    return ChatCompletionChunk(
        id="chatcmpl_123",
        choices=[Choice(
            index=0,
            delta=ChoiceDelta(content="Hello"),
            finish_reason=None
        )],
        model="gpt-4o",
        object="chat.completion.chunk"
    )


@pytest.fixture
def openai_finish_chunk():
    """Create OpenAI finish chunk with usage."""
    return ChatCompletionChunk(
        id="chatcmpl_123",
        choices=[Choice(
            index=0,
            delta=ChoiceDelta(),
            finish_reason="stop"
        )],
        model="gpt-4o",
        object="chat.completion.chunk",
        usage={"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30}
    )
```

---

## 9. Async Testing Patterns

### Testing Async Generators

```python
@pytest.mark.asyncio
async def test_async_generator_streaming():
    """Example of testing async generator."""
    # Arrange
    async def sample_generator():
        yield 1
        yield 2
        yield 3

    # Act
    results = []
    async for item in sample_generator():
        results.append(item)

    # Assert
    assert results == [1, 2, 3]


@pytest.mark.asyncio
async def test_async_generator_with_exception():
    """Test async generator that raises exception."""
    async def failing_generator():
        yield 1
        raise ValueError("Something went wrong")

    with pytest.raises(ValueError, match="Something went wrong"):
        async for _ in failing_generator():
            pass
```

### Mocking Async Methods

```python
@pytest.mark.asyncio
async def test_async_mock_example():
    """Example of mocking async method."""
    # Create async mock
    mock_service = AsyncMock()
    mock_service.fetch_data.return_value = {"result": "success"}

    # Use mock
    result = await mock_service.fetch_data(param="test")

    # Assert
    assert result["result"] == "success"
    mock_service.fetch_data.assert_called_once_with(param="test")
```

---

## 10. Coverage Best Practices

### Running Tests with Coverage

```bash
# Run all tests with coverage
pytest

# Run specific test file
pytest tests/unit/domain/test_message_entity.py -v

# Run with coverage report
pytest --cov=api --cov-report=html

# Run only unit tests
pytest -m unit

# Run fast tests (exclude slow)
pytest -m "not slow"

# Run specific layer tests
pytest -m domain
pytest -m application
pytest -m infrastructure
pytest -m web
```

### Coverage Goals by Layer

| Layer | Target Coverage | Critical Areas |
|-------|----------------|----------------|
| Domain | 95%+ | Entity validation, business rules |
| Application | 90%+ | Use case orchestration, error handling |
| Infrastructure | 85%+ | Adapter implementations, protocol encoding |
| Web | 80%+ | Routers, DTOs, mappers |

---

## 11. Key Testing Principles

### 1. **Isolation**
- Mock all external dependencies (OpenAI, HTTP clients, databases)
- Test one unit at a time
- Use dependency injection for easy mocking

### 2. **AAA Pattern**
- **Arrange**: Set up test data and mocks
- **Act**: Execute the code under test
- **Assert**: Verify expected outcomes

### 3. **Test Naming**
```python
# Format: test_<method>_<scenario>_<expected_result>
def test_create_message_with_empty_content_raises_validation_error()
def test_execute_use_case_with_tool_call_returns_tool_result_chunk()
```

### 4. **Parametrized Tests**
Use `@pytest.mark.parametrize` for testing multiple scenarios:
```python
@pytest.mark.parametrize("input,expected", [
    ("user", MessageRole.USER),
    ("assistant", MessageRole.ASSISTANT),
])
def test_role_conversion(input, expected):
    assert convert_role(input) == expected
```

### 5. **Async Testing**
- Always use `@pytest.mark.asyncio` for async tests
- Mock async methods with `AsyncMock`
- Test async generators properly

### 6. **Error Testing**
```python
with pytest.raises(SpecificException, match="error message pattern"):
    code_that_should_raise()
```

---

## 12. Common Pitfalls to Avoid

1. **Don't test implementation details** - Test behavior, not internals
2. **Don't mock what you don't own** - Create adapters for external libraries
3. **Don't create test interdependencies** - Each test should be independent
4. **Don't ignore async/await** - Use proper async mocking
5. **Don't skip edge cases** - Test empty lists, None values, boundary conditions
6. **Don't use real external services** - Always mock HTTP calls, API clients

---

## 13. Next Steps

1. **Install test dependencies**
   ```bash
   pip install pytest pytest-asyncio pytest-cov pytest-mock faker freezegun
   ```

2. **Create initial test structure**
   ```bash
   mkdir -p tests/{unit/{domain,application,infrastructure,web},fixtures}
   touch tests/conftest.py
   touch pytest.ini
   ```

3. **Start with domain layer** - Easiest to test, no external dependencies

4. **Move to application layer** - Mock ports, test use cases

5. **Then infrastructure** - Mock external services

6. **Finally web layer** - Use TestClient, override dependencies

7. **Track coverage** - Run `pytest --cov=api --cov-report=html` regularly

---

## Summary

This testing strategy provides:
- ✅ Comprehensive test structure for hexagonal architecture
- ✅ Concrete examples for each layer
- ✅ Pytest configuration for 80%+ coverage
- ✅ Async testing patterns for streaming use cases
- ✅ Proper mocking of ports and adapters
- ✅ FastAPI TestClient patterns for web layer
- ✅ Shared fixtures and reusable test utilities

The key principle: **Test behavior, not implementation. Mock dependencies at architectural boundaries.**
