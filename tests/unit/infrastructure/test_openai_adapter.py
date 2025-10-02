# ABOUTME: Unit tests for OpenAI LLM adapter
# ABOUTME: Tests streaming chunks, tool calls, message conversion, and error handling with mocked OpenAI client
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncIterator

from api.infrastructure.llm.openai_adapter import OpenAILLMAdapter
from api.domain.entities.message import Message, MessageRole, Attachment
from api.domain.entities.tool import ITool, ToolInput
from api.domain.ports.llm_provider import LLMTextDelta, LLMToolCallDelta, LLMFinished
from api.domain.exceptions import LLMProviderError, RateLimitError
from pydantic import Field


class TestOpenAILLMAdapter:
    """Tests for OpenAI LLM adapter"""

    @pytest.fixture
    def mock_openai_client(self):
        """Mock OpenAI client"""
        client = MagicMock()
        client.chat.completions.create = AsyncMock()
        return client

    @pytest.fixture
    def adapter_with_mock(self, mock_openai_client):
        """Create adapter with mocked OpenAI client"""
        with patch('api.infrastructure.llm.openai_adapter.AsyncOpenAI', return_value=mock_openai_client):
            adapter = OpenAILLMAdapter(api_key="test-api-key")
            return adapter, mock_openai_client

    @pytest.mark.asyncio
    async def test_stream_completion_text_chunks(self, adapter_with_mock):
        """Test streaming text chunks from OpenAI"""
        # Arrange
        adapter, mock_client = adapter_with_mock
        messages = [Message(role=MessageRole.USER, content="Hello")]

        # Mock OpenAI streaming response
        async def mock_stream():
            # Text chunk 1
            chunk1 = MagicMock()
            chunk1.choices = [MagicMock()]
            chunk1.choices[0].delta.content = "Hello"
            chunk1.choices[0].delta.tool_calls = None
            chunk1.choices[0].finish_reason = None
            chunk1.usage = None
            yield chunk1

            # Text chunk 2
            chunk2 = MagicMock()
            chunk2.choices = [MagicMock()]
            chunk2.choices[0].delta.content = " world"
            chunk2.choices[0].delta.tool_calls = None
            chunk2.choices[0].finish_reason = None
            chunk2.usage = None
            yield chunk2

            # Final chunk with usage
            chunk3 = MagicMock()
            chunk3.choices = [MagicMock()]
            chunk3.choices[0].delta.content = None
            chunk3.choices[0].delta.tool_calls = None
            chunk3.choices[0].finish_reason = "stop"
            chunk3.usage = MagicMock()
            chunk3.usage.prompt_tokens = 10
            chunk3.usage.completion_tokens = 5
            yield chunk3

        mock_client.chat.completions.create.return_value = mock_stream()

        # Act
        events = []
        async for event in adapter.stream_completion(messages=messages, tools=[]):
            events.append(event)

        # Assert
        assert len(events) == 3
        assert isinstance(events[0], LLMTextDelta)
        assert events[0].content == "Hello"
        assert isinstance(events[1], LLMTextDelta)
        assert events[1].content == " world"
        assert isinstance(events[2], LLMFinished)
        assert events[2].finish_reason == "stop"
        assert events[2].prompt_tokens == 10
        assert events[2].completion_tokens == 5

    @pytest.mark.asyncio
    async def test_stream_completion_with_tool_calls(self, adapter_with_mock):
        """Test streaming tool call chunks"""
        # Arrange
        adapter, mock_client = adapter_with_mock
        messages = [Message(role=MessageRole.USER, content="Weather?")]

        async def mock_stream():
            # Tool call start
            chunk1 = MagicMock()
            chunk1.choices = [MagicMock()]
            chunk1.choices[0].delta.content = None
            chunk1.choices[0].delta.tool_calls = [MagicMock()]
            chunk1.choices[0].delta.tool_calls[0].index = 0
            chunk1.choices[0].delta.tool_calls[0].id = "call_123"
            chunk1.choices[0].delta.tool_calls[0].function = MagicMock()
            chunk1.choices[0].delta.tool_calls[0].function.name = "get_weather"
            chunk1.choices[0].delta.tool_calls[0].function.arguments = None
            chunk1.choices[0].finish_reason = None
            chunk1.usage = None
            yield chunk1

            # Tool arguments chunk
            chunk2 = MagicMock()
            chunk2.choices = [MagicMock()]
            chunk2.choices[0].delta.content = None
            chunk2.choices[0].delta.tool_calls = [MagicMock()]
            chunk2.choices[0].delta.tool_calls[0].index = 0
            chunk2.choices[0].delta.tool_calls[0].id = None
            chunk2.choices[0].delta.tool_calls[0].function = MagicMock()
            chunk2.choices[0].delta.tool_calls[0].function.name = None
            chunk2.choices[0].delta.tool_calls[0].function.arguments = '{"city":"SF"}'
            chunk2.choices[0].finish_reason = None
            chunk2.usage = None
            yield chunk2

            # Final chunk
            chunk3 = MagicMock()
            chunk3.choices = [MagicMock()]
            chunk3.choices[0].delta.content = None
            chunk3.choices[0].delta.tool_calls = None
            chunk3.choices[0].finish_reason = "tool_calls"
            chunk3.usage = MagicMock()
            chunk3.usage.prompt_tokens = 15
            chunk3.usage.completion_tokens = 0
            yield chunk3

        mock_client.chat.completions.create.return_value = mock_stream()

        # Act
        events = []
        async for event in adapter.stream_completion(messages=messages, tools=[]):
            events.append(event)

        # Assert
        assert len(events) == 3
        assert isinstance(events[0], LLMToolCallDelta)
        assert events[0].index == 0
        assert events[0].id == "call_123"
        assert events[0].name == "get_weather"
        assert isinstance(events[1], LLMToolCallDelta)
        assert events[1].arguments_chunk == '{"city":"SF"}'
        assert isinstance(events[2], LLMFinished)
        assert events[2].finish_reason == "tool_calls"

    @pytest.mark.asyncio
    async def test_stream_completion_raises_rate_limit_error(self, adapter_with_mock):
        """Test handling of rate limit errors"""
        # Arrange
        adapter, mock_client = adapter_with_mock
        messages = [Message(role=MessageRole.USER, content="Test")]

        mock_client.chat.completions.create.side_effect = Exception("rate_limit exceeded")

        # Act & Assert
        with pytest.raises(RateLimitError):
            async for _ in adapter.stream_completion(messages=messages, tools=[]):
                pass

    @pytest.mark.asyncio
    async def test_stream_completion_raises_llm_provider_error(self, adapter_with_mock):
        """Test handling of generic LLM provider errors"""
        # Arrange
        adapter, mock_client = adapter_with_mock
        messages = [Message(role=MessageRole.USER, content="Test")]

        mock_client.chat.completions.create.side_effect = Exception("API connection failed")

        # Act & Assert
        with pytest.raises(LLMProviderError):
            async for _ in adapter.stream_completion(messages=messages, tools=[]):
                pass

    def test_convert_messages_user_message(self, adapter_with_mock):
        """Test converting user message to OpenAI format"""
        # Arrange
        adapter, _ = adapter_with_mock
        messages = [Message(role=MessageRole.USER, content="Hello")]

        # Act
        openai_messages = adapter._convert_messages(messages)

        # Assert
        assert len(openai_messages) == 1
        assert openai_messages[0]["role"] == "user"
        assert openai_messages[0]["content"][0]["type"] == "text"
        assert openai_messages[0]["content"][0]["text"] == "Hello"

    def test_convert_messages_with_attachments(self, adapter_with_mock):
        """Test converting message with image attachments"""
        # Arrange
        adapter, _ = adapter_with_mock
        attachment = Attachment(content_type="image/png", url="https://example.com/img.png")
        messages = [Message(role=MessageRole.USER, content="Check this", attachments=[attachment])]

        # Act
        openai_messages = adapter._convert_messages(messages)

        # Assert
        assert len(openai_messages[0]["content"]) == 2
        assert openai_messages[0]["content"][0]["type"] == "text"
        assert openai_messages[0]["content"][1]["type"] == "image_url"
        assert openai_messages[0]["content"][1]["image_url"]["url"] == "https://example.com/img.png"

    def test_convert_messages_tool_message(self, adapter_with_mock):
        """Test converting tool response message"""
        # Arrange
        adapter, _ = adapter_with_mock
        messages = [Message(role=MessageRole.TOOL, content='{"result":"data"}', tool_call_id="call_123")]

        # Act
        openai_messages = adapter._convert_messages(messages)

        # Assert
        assert openai_messages[0]["role"] == "tool"
        assert openai_messages[0]["tool_call_id"] == "call_123"
        assert openai_messages[0]["content"] == '{"result":"data"}'

    def test_convert_tool_to_openai_format(self, adapter_with_mock):
        """Test converting ITool to OpenAI tool format"""
        # Arrange
        adapter, _ = adapter_with_mock

        class TestToolInput(ToolInput):
            value: int = Field(description="Test value")

        class TestTool(ITool):
            @property
            def name(self) -> str:
                return "test_tool"

            @property
            def description(self) -> str:
                return "A test tool"

            @property
            def input_schema(self) -> type[ToolInput]:
                return TestToolInput

            async def execute(self, tool_input: ToolInput):
                return {}

        tool = TestTool()

        # Act
        openai_tool = adapter._convert_tool(tool)

        # Assert
        assert openai_tool["type"] == "function"
        assert openai_tool["function"]["name"] == "test_tool"
        assert openai_tool["function"]["description"] == "A test tool"
        assert "parameters" in openai_tool["function"]
