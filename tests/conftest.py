# ABOUTME: Pytest configuration and shared fixtures for all test modules
# ABOUTME: Provides reusable test fixtures for entities, mocks, and test data
import pytest
from typing import AsyncIterator, List
from unittest.mock import AsyncMock, MagicMock

from api.domain.entities.message import Message, MessageRole, Attachment
from api.domain.entities.tool import ToolCall, ToolResult, ITool, ToolInput
from api.domain.entities.events import (
    TextDelta, ToolCallCompleted, ToolResultAvailable,
    CompletionFinished, UsageStats
)
from api.domain.ports.llm_provider import ILLMProvider, LLMTextDelta, LLMFinished
from api.domain.ports.tool_executor import IToolExecutor
from api.domain.ports.weather_service import IWeatherService


# Domain Fixtures

@pytest.fixture
def sample_message():
    """Sample domain message"""
    return Message(
        role=MessageRole.USER,
        content="What's the weather in SF?"
    )


@pytest.fixture
def sample_messages():
    """Sample list of domain messages"""
    return [
        Message(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
        Message(role=MessageRole.USER, content="What's the weather in San Francisco?")
    ]


@pytest.fixture
def sample_tool_call():
    """Sample tool call"""
    return ToolCall(
        id="call_123",
        name="get_current_weather",
        arguments={"latitude": 37.7749, "longitude": -122.4194}
    )


@pytest.fixture
def sample_tool_result():
    """Sample tool result"""
    return ToolResult(
        call_id="call_123",
        name="get_current_weather",
        result={"temperature": 72, "conditions": "sunny"}
    )


# Mock Fixtures

@pytest.fixture
def mock_llm_provider():
    """Mock LLM provider"""
    mock = AsyncMock(spec=ILLMProvider)

    async def mock_stream(*args, **kwargs):
        yield LLMTextDelta(content="Hello")
        yield LLMTextDelta(content=" world")
        yield LLMFinished(
            finish_reason="stop",
            prompt_tokens=10,
            completion_tokens=5
        )

    mock.stream_completion = mock_stream
    return mock


@pytest.fixture
def mock_tool_executor():
    """Mock tool executor"""
    mock = MagicMock(spec=IToolExecutor)
    mock.get_registered_tools.return_value = []
    mock.execute = AsyncMock(return_value=ToolResult(
        call_id="call_123",
        name="get_current_weather",
        result={"temperature": 72}
    ))
    return mock


@pytest.fixture
def mock_weather_service():
    """Mock weather service"""
    mock = AsyncMock(spec=IWeatherService)
    mock.get_weather.return_value = {
        "current": {"temperature_2m": 72},
        "hourly": {"temperature_2m": [70, 71, 72]},
        "daily": {"sunrise": ["06:30"], "sunset": ["19:45"]}
    }
    return mock


# Event Fixtures

@pytest.fixture
def sample_text_delta():
    """Sample text delta event"""
    return TextDelta(content="Hello")


@pytest.fixture
def sample_completion_finished():
    """Sample completion finished event"""
    return CompletionFinished(
        finish_reason="stop",
        usage=UsageStats(
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15
        )
    )
