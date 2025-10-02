# ABOUTME: Unit tests for StreamChatCompletionUseCase
# ABOUTME: Tests async generator orchestration with mocked ports, tool execution flow, and error handling
import pytest
from unittest.mock import AsyncMock, MagicMock
from typing import AsyncIterator

from api.application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from api.domain.entities.message import Message, MessageRole
from api.domain.entities.events import (
    StreamEvent, TextDelta, ToolCallStarted, ToolCallArgumentChunk,
    ToolCallCompleted, ToolResultAvailable, CompletionFinished
)
from api.domain.entities.tool import ToolCall, ToolResult, ITool, ToolInput
from api.domain.ports.llm_provider import ILLMProvider, LLMTextDelta, LLMToolCallDelta, LLMFinished
from api.domain.ports.tool_executor import IToolExecutor
from api.domain.exceptions import ToolExecutionError


class TestStreamChatCompletionUseCase:
    """Tests for StreamChatCompletionUseCase"""

    @pytest.fixture
    def mock_llm_provider(self):
        """Create mock LLM provider"""
        return AsyncMock(spec=ILLMProvider)

    @pytest.fixture
    def mock_tool_executor(self):
        """Create mock tool executor"""
        mock = MagicMock(spec=IToolExecutor)
        mock.get_registered_tools.return_value = []
        mock.execute = AsyncMock()
        return mock

    @pytest.fixture
    def use_case(self, mock_llm_provider, mock_tool_executor):
        """Create use case instance with mocked dependencies"""
        return StreamChatCompletionUseCase(
            llm_provider=mock_llm_provider,
            tool_executor=mock_tool_executor
        )

    @pytest.mark.asyncio
    async def test_execute_simple_text_streaming(self, use_case, mock_llm_provider):
        """Test streaming simple text response without tools"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Hello")]

        async def mock_stream(*args, **kwargs):
            yield LLMTextDelta(content="Hello")
            yield LLMTextDelta(content=" world")
            yield LLMFinished(
                finish_reason="stop",
                prompt_tokens=10,
                completion_tokens=5
            )

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        assert len(events) == 3
        assert isinstance(events[0], TextDelta)
        assert events[0].content == "Hello"
        assert isinstance(events[1], TextDelta)
        assert events[1].content == " world"
        assert isinstance(events[2], CompletionFinished)
        assert events[2].finish_reason == "stop"
        assert events[2].usage.prompt_tokens == 10
        assert events[2].usage.completion_tokens == 5
        assert events[2].usage.total_tokens == 15

    @pytest.mark.asyncio
    async def test_execute_empty_message_list(self, use_case, mock_llm_provider):
        """Test execute with empty message list"""
        # Arrange
        messages = []

        async def mock_stream(*args, **kwargs):
            yield LLMFinished(
                finish_reason="stop",
                prompt_tokens=0,
                completion_tokens=0
            )

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        assert len(events) == 1
        assert isinstance(events[0], CompletionFinished)

    @pytest.mark.asyncio
    async def test_execute_with_tool_call_and_execution(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test streaming with tool call invocation and execution"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="What's the weather?")]

        async def mock_stream(*args, **kwargs):
            yield LLMToolCallDelta(
                index=0,
                id="call_abc123",
                name="get_current_weather",
                arguments_chunk=None
            )
            yield LLMToolCallDelta(
                index=0,
                id=None,
                name=None,
                arguments_chunk='{"latitude":'
            )
            yield LLMToolCallDelta(
                index=0,
                id=None,
                name=None,
                arguments_chunk='37.7749,'
            )
            yield LLMToolCallDelta(
                index=0,
                id=None,
                name=None,
                arguments_chunk='"longitude":-122.4194}'
            )
            yield LLMFinished(
                finish_reason="tool_calls",
                prompt_tokens=15,
                completion_tokens=0
            )

        mock_llm_provider.stream_completion = mock_stream

        # Mock tool execution
        mock_tool_executor.execute.return_value = ToolResult(
            call_id="call_abc123",
            name="get_current_weather",
            result={"temperature": 72, "conditions": "sunny"}
        )

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        assert len(events) == 7  # ToolCallStarted + 3 ArgumentChunks + ToolCallCompleted + ToolResultAvailable + CompletionFinished

        # Verify tool call started
        assert isinstance(events[0], ToolCallStarted)
        assert events[0].call_id == "call_abc123"
        assert events[0].tool_name == "get_current_weather"

        # Verify argument chunks
        assert isinstance(events[1], ToolCallArgumentChunk)
        assert events[1].arguments_chunk == '{"latitude":'
        assert isinstance(events[2], ToolCallArgumentChunk)
        assert events[2].arguments_chunk == '37.7749,'
        assert isinstance(events[3], ToolCallArgumentChunk)
        assert events[3].arguments_chunk == '"longitude":-122.4194}'

        # Verify tool call completed
        assert isinstance(events[4], ToolCallCompleted)
        assert events[4].tool_call.id == "call_abc123"
        assert events[4].tool_call.name == "get_current_weather"
        assert events[4].tool_call.arguments["latitude"] == 37.7749
        assert events[4].tool_call.arguments["longitude"] == -122.4194

        # Verify tool result
        assert isinstance(events[5], ToolResultAvailable)
        assert events[5].tool_result.call_id == "call_abc123"
        assert events[5].tool_result.result["temperature"] == 72

        # Verify completion
        assert isinstance(events[6], CompletionFinished)
        assert events[6].finish_reason == "tool_calls"

        # Verify tool executor was called
        mock_tool_executor.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_with_multiple_tool_calls(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test streaming with multiple simultaneous tool calls"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Weather in SF and NYC?")]

        async def mock_stream(*args, **kwargs):
            # First tool call
            yield LLMToolCallDelta(index=0, id="call_1", name="get_weather", arguments_chunk=None)
            yield LLMToolCallDelta(index=0, id=None, name=None, arguments_chunk='{"city":"SF"}')

            # Second tool call
            yield LLMToolCallDelta(index=1, id="call_2", name="get_weather", arguments_chunk=None)
            yield LLMToolCallDelta(index=1, id=None, name=None, arguments_chunk='{"city":"NYC"}')

            yield LLMFinished(finish_reason="tool_calls", prompt_tokens=20, completion_tokens=0)

        mock_llm_provider.stream_completion = mock_stream

        # Mock tool execution to return different results
        async def mock_execute(tool_call):
            if tool_call.arguments["city"] == "SF":
                return ToolResult(call_id="call_1", name="get_weather", result={"temp": 72})
            else:
                return ToolResult(call_id="call_2", name="get_weather", result={"temp": 65})

        mock_tool_executor.execute.side_effect = mock_execute

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        tool_completed_events = [e for e in events if isinstance(e, ToolCallCompleted)]
        assert len(tool_completed_events) == 2
        assert tool_completed_events[0].tool_call.id == "call_1"
        assert tool_completed_events[1].tool_call.id == "call_2"

        tool_result_events = [e for e in events if isinstance(e, ToolResultAvailable)]
        assert len(tool_result_events) == 2

        # Verify tool executor was called twice
        assert mock_tool_executor.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_execute_mixed_text_and_tool_calls(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test streaming with mixed text and tool calls"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Check weather and tell me")]

        async def mock_stream(*args, **kwargs):
            yield LLMTextDelta(content="Let me check")
            yield LLMToolCallDelta(index=0, id="call_1", name="get_weather", arguments_chunk=None)
            yield LLMToolCallDelta(index=0, id=None, name=None, arguments_chunk='{"city":"SF"}')
            yield LLMTextDelta(content=" the weather")
            yield LLMFinished(finish_reason="stop", prompt_tokens=10, completion_tokens=5)

        mock_llm_provider.stream_completion = mock_stream

        mock_tool_executor.execute.return_value = ToolResult(
            call_id="call_1",
            name="get_weather",
            result={"temp": 72}
        )

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        text_deltas = [e for e in events if isinstance(e, TextDelta)]
        assert len(text_deltas) == 2
        assert text_deltas[0].content == "Let me check"
        assert text_deltas[1].content == " the weather"

        tool_started_events = [e for e in events if isinstance(e, ToolCallStarted)]
        assert len(tool_started_events) == 1

    @pytest.mark.asyncio
    async def test_execute_calls_get_registered_tools(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test that execute calls get_registered_tools"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Hello")]

        async def mock_stream(*args, **kwargs):
            yield LLMTextDelta(content="Hi")
            yield LLMFinished(finish_reason="stop", prompt_tokens=5, completion_tokens=2)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        async for _ in use_case.execute(messages=messages):
            pass

        # Assert
        mock_tool_executor.get_registered_tools.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_passes_tools_to_llm_provider(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test that execute passes registered tools to LLM provider"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Hello")]

        mock_tool = MagicMock(spec=ITool)
        mock_tool.name = "test_tool"
        mock_tool_executor.get_registered_tools.return_value = [mock_tool]

        async def mock_stream(msgs, tools):
            # Verify tools were passed
            assert tools == [mock_tool]
            yield LLMFinished(finish_reason="stop", prompt_tokens=5, completion_tokens=2)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        async for _ in use_case.execute(messages=messages):
            pass

        # Assert - verified in mock_stream

    @pytest.mark.asyncio
    async def test_execute_handles_tool_execution_error(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test that tool execution errors are propagated"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Weather?")]

        async def mock_stream(*args, **kwargs):
            yield LLMToolCallDelta(index=0, id="call_1", name="get_weather", arguments_chunk=None)
            yield LLMToolCallDelta(index=0, id=None, name=None, arguments_chunk='{"city":"SF"}')
            yield LLMFinished(finish_reason="tool_calls", prompt_tokens=10, completion_tokens=0)

        mock_llm_provider.stream_completion = mock_stream

        # Mock tool execution to raise error
        mock_tool_executor.execute.side_effect = ToolExecutionError(
            "get_weather",
            Exception("API error")
        )

        # Act & Assert
        with pytest.raises(ToolExecutionError):
            async for _ in use_case.execute(messages=messages):
                pass

    @pytest.mark.asyncio
    async def test_execute_handles_malformed_tool_arguments(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test handling of malformed JSON in tool arguments"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Test")]

        async def mock_stream(*args, **kwargs):
            yield LLMToolCallDelta(index=0, id="call_1", name="test_tool", arguments_chunk=None)
            yield LLMToolCallDelta(index=0, id=None, name=None, arguments_chunk='{"invalid":')  # Malformed JSON
            yield LLMFinished(finish_reason="tool_calls", prompt_tokens=5, completion_tokens=0)

        mock_llm_provider.stream_completion = mock_stream

        # Act & Assert
        with pytest.raises(Exception):  # JSON decode error
            async for _ in use_case.execute(messages=messages):
                pass

    @pytest.mark.asyncio
    async def test_execute_with_long_streaming_response(
        self, use_case, mock_llm_provider
    ):
        """Test execute with many text chunks"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Tell me a story")]

        async def mock_stream(*args, **kwargs):
            for i in range(100):
                yield LLMTextDelta(content=f"word{i} ")
            yield LLMFinished(finish_reason="stop", prompt_tokens=10, completion_tokens=100)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        text_events = [e for e in events if isinstance(e, TextDelta)]
        assert len(text_events) == 100
        assert text_events[0].content == "word0 "
        assert text_events[99].content == "word99 "

    @pytest.mark.asyncio
    async def test_execute_with_finish_reason_length(
        self, use_case, mock_llm_provider
    ):
        """Test execute with length finish reason"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Long request")]

        async def mock_stream(*args, **kwargs):
            yield LLMTextDelta(content="This is a very long response that was cut off")
            yield LLMFinished(finish_reason="length", prompt_tokens=50, completion_tokens=4096)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        completion_event = [e for e in events if isinstance(e, CompletionFinished)][0]
        assert completion_event.finish_reason == "length"
        assert completion_event.usage.completion_tokens == 4096

    @pytest.mark.asyncio
    async def test_execute_with_finish_reason_content_filter(
        self, use_case, mock_llm_provider
    ):
        """Test execute with content_filter finish reason"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Filtered content")]

        async def mock_stream(*args, **kwargs):
            yield LLMTextDelta(content="Partial response")
            yield LLMFinished(finish_reason="content_filter", prompt_tokens=10, completion_tokens=5)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        completion_event = [e for e in events if isinstance(e, CompletionFinished)][0]
        assert completion_event.finish_reason == "content_filter"

    @pytest.mark.asyncio
    async def test_execute_usage_stats_calculation(
        self, use_case, mock_llm_provider
    ):
        """Test that usage stats are correctly calculated"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Test")]

        async def mock_stream(*args, **kwargs):
            yield LLMTextDelta(content="Response")
            yield LLMFinished(finish_reason="stop", prompt_tokens=123, completion_tokens=456)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        completion_event = [e for e in events if isinstance(e, CompletionFinished)][0]
        assert completion_event.usage.prompt_tokens == 123
        assert completion_event.usage.completion_tokens == 456
        assert completion_event.usage.total_tokens == 579  # 123 + 456

    @pytest.mark.asyncio
    async def test_execute_preserves_tool_call_id_across_events(
        self, use_case, mock_llm_provider, mock_tool_executor
    ):
        """Test that tool call ID is preserved across all related events"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Test")]

        async def mock_stream(*args, **kwargs):
            yield LLMToolCallDelta(index=0, id="call_unique_123", name="test", arguments_chunk=None)
            yield LLMToolCallDelta(index=0, id=None, name=None, arguments_chunk='{"a":1}')
            yield LLMFinished(finish_reason="tool_calls", prompt_tokens=10, completion_tokens=0)

        mock_llm_provider.stream_completion = mock_stream

        mock_tool_executor.execute.return_value = ToolResult(
            call_id="call_unique_123",
            name="test",
            result={"b": 2}
        )

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        started_event = [e for e in events if isinstance(e, ToolCallStarted)][0]
        assert started_event.call_id == "call_unique_123"

        chunk_events = [e for e in events if isinstance(e, ToolCallArgumentChunk)]
        assert all(e.call_id == "call_unique_123" for e in chunk_events)

        completed_event = [e for e in events if isinstance(e, ToolCallCompleted)][0]
        assert completed_event.tool_call.id == "call_unique_123"

        result_event = [e for e in events if isinstance(e, ToolResultAvailable)][0]
        assert result_event.tool_result.call_id == "call_unique_123"

    @pytest.mark.asyncio
    async def test_execute_with_empty_tool_name(
        self, use_case, mock_llm_provider
    ):
        """Test execute handles empty tool name gracefully"""
        # Arrange
        messages = [Message(role=MessageRole.USER, content="Test")]

        async def mock_stream(*args, **kwargs):
            yield LLMToolCallDelta(index=0, id="call_1", name="", arguments_chunk=None)
            yield LLMFinished(finish_reason="tool_calls", prompt_tokens=5, completion_tokens=0)

        mock_llm_provider.stream_completion = mock_stream

        # Act
        events = []
        async for event in use_case.execute(messages=messages):
            events.append(event)

        # Assert
        started_event = [e for e in events if isinstance(e, ToolCallStarted)][0]
        assert started_event.tool_name == ""
