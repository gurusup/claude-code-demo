# ABOUTME: Unit tests for domain StreamEvent entities
# ABOUTME: Tests event validation, immutability, and event hierarchy
import pytest
from dataclasses import FrozenInstanceError
from abc import ABC

from api.domain.entities.events import (
    StreamEvent, TextDelta, ToolCallStarted, ToolCallArgumentChunk,
    ToolCallCompleted, ToolResultAvailable, CompletionFinished, UsageStats
)
from api.domain.entities.tool import ToolCall, ToolResult


class TestStreamEvent:
    """Tests for StreamEvent base class"""

    def test_stream_event_is_abstract_base_class(self):
        """Test that StreamEvent is an ABC"""
        assert issubclass(StreamEvent, ABC)

    def test_all_event_types_inherit_from_stream_event(self):
        """Test that all event types inherit from StreamEvent"""
        assert issubclass(TextDelta, StreamEvent)
        assert issubclass(ToolCallStarted, StreamEvent)
        assert issubclass(ToolCallArgumentChunk, StreamEvent)
        assert issubclass(ToolCallCompleted, StreamEvent)
        assert issubclass(ToolResultAvailable, StreamEvent)
        assert issubclass(CompletionFinished, StreamEvent)


class TestTextDelta:
    """Tests for TextDelta event"""

    def test_create_text_delta_successfully(self):
        """Test creating a valid text delta event"""
        # Arrange & Act
        event = TextDelta(content="Hello world")

        # Assert
        assert event.content == "Hello world"
        assert isinstance(event, StreamEvent)

    def test_text_delta_is_immutable(self):
        """Test that TextDelta is immutable (frozen dataclass)"""
        # Arrange
        event = TextDelta(content="Hello")

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            event.content = "Modified"

    def test_text_delta_with_empty_content(self):
        """Test text delta with empty content"""
        # Arrange & Act
        event = TextDelta(content="")

        # Assert
        assert event.content == ""

    def test_text_delta_with_unicode(self):
        """Test text delta with unicode characters"""
        # Arrange & Act
        event = TextDelta(content="Hello 👋 世界")

        # Assert
        assert event.content == "Hello 👋 世界"

    @pytest.mark.parametrize("content", [
        "Simple text",
        "Text with\nnewlines",
        "Special chars: @#$%^&*()",
        "Long " + "text " * 1000,
        "123456789",
        "",
    ])
    def test_text_delta_with_various_content(self, content):
        """Parametrized test for text delta with various content"""
        event = TextDelta(content=content)
        assert event.content == content


class TestToolCallStarted:
    """Tests for ToolCallStarted event"""

    def test_create_tool_call_started_successfully(self):
        """Test creating a valid tool call started event"""
        # Arrange & Act
        event = ToolCallStarted(
            call_id="call_abc123",
            tool_name="get_current_weather"
        )

        # Assert
        assert event.call_id == "call_abc123"
        assert event.tool_name == "get_current_weather"
        assert isinstance(event, StreamEvent)

    def test_tool_call_started_is_immutable(self):
        """Test that ToolCallStarted is immutable"""
        # Arrange
        event = ToolCallStarted(call_id="call_123", tool_name="test")

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            event.call_id = "modified"


class TestToolCallArgumentChunk:
    """Tests for ToolCallArgumentChunk event"""

    def test_create_tool_call_argument_chunk_successfully(self):
        """Test creating a valid tool call argument chunk event"""
        # Arrange & Act
        event = ToolCallArgumentChunk(
            call_id="call_abc123",
            arguments_chunk='{"latitude":'
        )

        # Assert
        assert event.call_id == "call_abc123"
        assert event.arguments_chunk == '{"latitude":'
        assert isinstance(event, StreamEvent)

    def test_tool_call_argument_chunk_is_immutable(self):
        """Test that ToolCallArgumentChunk is immutable"""
        # Arrange
        event = ToolCallArgumentChunk(call_id="call_123", arguments_chunk="{")

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            event.arguments_chunk = "{"

    @pytest.mark.parametrize("chunk", [
        '{"lat":',
        '37.7749,',
        '"lon":-122.4194}',
        "",
        "null",
    ])
    def test_tool_call_argument_chunk_with_various_chunks(self, chunk):
        """Parametrized test for argument chunks"""
        event = ToolCallArgumentChunk(call_id="call_123", arguments_chunk=chunk)
        assert event.arguments_chunk == chunk


class TestToolCallCompleted:
    """Tests for ToolCallCompleted event"""

    def test_create_tool_call_completed_successfully(self):
        """Test creating a valid tool call completed event"""
        # Arrange
        tool_call = ToolCall(
            id="call_abc123",
            name="get_current_weather",
            arguments={"latitude": 37.7749, "longitude": -122.4194}
        )

        # Act
        event = ToolCallCompleted(tool_call=tool_call)

        # Assert
        assert event.tool_call == tool_call
        assert event.tool_call.id == "call_abc123"
        assert event.tool_call.name == "get_current_weather"
        assert isinstance(event, StreamEvent)

    def test_tool_call_completed_is_immutable(self):
        """Test that ToolCallCompleted is immutable"""
        # Arrange
        tool_call = ToolCall(id="call_123", name="test", arguments={})
        event = ToolCallCompleted(tool_call=tool_call)

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            event.tool_call = ToolCall(id="call_456", name="other", arguments={})


class TestToolResultAvailable:
    """Tests for ToolResultAvailable event"""

    def test_create_tool_result_available_successfully(self):
        """Test creating a valid tool result available event"""
        # Arrange
        tool_result = ToolResult(
            call_id="call_abc123",
            name="get_current_weather",
            result={"temperature": 72, "conditions": "sunny"}
        )

        # Act
        event = ToolResultAvailable(tool_result=tool_result)

        # Assert
        assert event.tool_result == tool_result
        assert event.tool_result.call_id == "call_abc123"
        assert event.tool_result.name == "get_current_weather"
        assert event.tool_result.result["temperature"] == 72
        assert isinstance(event, StreamEvent)

    def test_tool_result_available_is_immutable(self):
        """Test that ToolResultAvailable is immutable"""
        # Arrange
        tool_result = ToolResult(call_id="call_123", name="test", result={})
        event = ToolResultAvailable(tool_result=tool_result)

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            event.tool_result = ToolResult(call_id="call_456", name="other", result={})


class TestUsageStats:
    """Tests for UsageStats value object"""

    def test_create_usage_stats_successfully(self):
        """Test creating valid usage stats"""
        # Arrange & Act
        stats = UsageStats(
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150
        )

        # Assert
        assert stats.prompt_tokens == 100
        assert stats.completion_tokens == 50
        assert stats.total_tokens == 150

    def test_usage_stats_is_immutable(self):
        """Test that UsageStats is immutable"""
        # Arrange
        stats = UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            stats.prompt_tokens = 20

    def test_usage_stats_with_zero_tokens(self):
        """Test usage stats with zero tokens"""
        # Arrange & Act
        stats = UsageStats(prompt_tokens=0, completion_tokens=0, total_tokens=0)

        # Assert
        assert stats.prompt_tokens == 0
        assert stats.completion_tokens == 0
        assert stats.total_tokens == 0

    def test_usage_stats_with_large_token_counts(self):
        """Test usage stats with large token counts"""
        # Arrange & Act
        stats = UsageStats(
            prompt_tokens=100000,
            completion_tokens=50000,
            total_tokens=150000
        )

        # Assert
        assert stats.total_tokens == 150000

    @pytest.mark.parametrize("prompt,completion,total", [
        (10, 5, 15),
        (0, 0, 0),
        (100, 50, 150),
        (1000, 2000, 3000),
    ])
    def test_usage_stats_with_various_values(self, prompt, completion, total):
        """Parametrized test for usage stats with various values"""
        stats = UsageStats(
            prompt_tokens=prompt,
            completion_tokens=completion,
            total_tokens=total
        )
        assert stats.prompt_tokens == prompt
        assert stats.completion_tokens == completion
        assert stats.total_tokens == total


class TestCompletionFinished:
    """Tests for CompletionFinished event"""

    def test_create_completion_finished_successfully(self):
        """Test creating a valid completion finished event"""
        # Arrange
        usage = UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)

        # Act
        event = CompletionFinished(finish_reason="stop", usage=usage)

        # Assert
        assert event.finish_reason == "stop"
        assert event.usage == usage
        assert event.usage.prompt_tokens == 10
        assert isinstance(event, StreamEvent)

    def test_completion_finished_is_immutable(self):
        """Test that CompletionFinished is immutable"""
        # Arrange
        usage = UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        event = CompletionFinished(finish_reason="stop", usage=usage)

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            event.finish_reason = "tool_calls"

    @pytest.mark.parametrize("finish_reason", [
        "stop",
        "tool_calls",
        "length",
        "content_filter",
    ])
    def test_completion_finished_with_various_finish_reasons(self, finish_reason):
        """Parametrized test for completion finished with various finish reasons"""
        usage = UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        event = CompletionFinished(finish_reason=finish_reason, usage=usage)
        assert event.finish_reason == finish_reason

    def test_completion_finished_with_tool_calls_reason(self):
        """Test completion finished with tool_calls finish reason"""
        # Arrange
        usage = UsageStats(prompt_tokens=20, completion_tokens=0, total_tokens=20)

        # Act
        event = CompletionFinished(finish_reason="tool_calls", usage=usage)

        # Assert
        assert event.finish_reason == "tool_calls"
        assert event.usage.completion_tokens == 0

    def test_completion_finished_with_length_reason(self):
        """Test completion finished with length finish reason"""
        # Arrange
        usage = UsageStats(prompt_tokens=50, completion_tokens=4096, total_tokens=4146)

        # Act
        event = CompletionFinished(finish_reason="length", usage=usage)

        # Assert
        assert event.finish_reason == "length"
        assert event.usage.completion_tokens == 4096


class TestEventEquality:
    """Tests for event equality comparisons"""

    def test_text_delta_equality(self):
        """Test that identical text deltas are equal"""
        event1 = TextDelta(content="Hello")
        event2 = TextDelta(content="Hello")
        assert event1 == event2

    def test_text_delta_inequality(self):
        """Test that different text deltas are not equal"""
        event1 = TextDelta(content="Hello")
        event2 = TextDelta(content="World")
        assert event1 != event2

    def test_usage_stats_equality(self):
        """Test that identical usage stats are equal"""
        stats1 = UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        stats2 = UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        assert stats1 == stats2

    def test_different_event_types_not_equal(self):
        """Test that different event types are not equal"""
        event1 = TextDelta(content="Hello")
        event2 = ToolCallStarted(call_id="call_123", tool_name="test")
        assert event1 != event2
