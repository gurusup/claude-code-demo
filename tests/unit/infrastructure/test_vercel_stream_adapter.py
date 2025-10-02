# ABOUTME: Unit tests for Vercel Stream Protocol adapter
# ABOUTME: Tests event-to-protocol conversion following Data Stream Protocol v1
import pytest
import json

from api.infrastructure.protocol.vercel_stream import VercelStreamProtocolAdapter
from api.domain.entities.events import (
    TextDelta, ToolCallCompleted, ToolResultAvailable,
    CompletionFinished, UsageStats, ToolCallStarted, ToolCallArgumentChunk
)
from api.domain.entities.tool import ToolCall, ToolResult


class TestVercelStreamProtocolAdapter:
    """Tests for Vercel Stream Protocol adapter"""

    @pytest.fixture
    def adapter(self):
        """Create protocol adapter instance"""
        return VercelStreamProtocolAdapter()

    def test_format_text_delta(self, adapter):
        """Test formatting text delta event"""
        # Arrange
        event = TextDelta(content="Hello world")

        # Act
        result = adapter.format_event(event)

        # Assert
        assert result.startswith('0:')
        assert '"Hello world"' in result
        assert result.endswith('\n')

    def test_format_tool_call_completed(self, adapter):
        """Test formatting tool call completed event"""
        # Arrange
        tool_call = ToolCall(
            id="call_abc123",
            name="get_weather",
            arguments={"latitude": 37.7749, "longitude": -122.4194}
        )
        event = ToolCallCompleted(tool_call=tool_call)

        # Act
        result = adapter.format_event(event)

        # Assert
        assert result.startswith('9:')
        assert '"toolCallId":"call_abc123"' in result
        assert '"toolName":"get_weather"' in result
        assert '"args":' in result
        assert result.endswith('\n')

    def test_format_tool_result_available(self, adapter):
        """Test formatting tool result available event"""
        # Arrange
        tool_result = ToolResult(
            call_id="call_abc123",
            name="get_weather",
            result={"temperature": 72, "conditions": "sunny"}
        )
        event = ToolResultAvailable(tool_result=tool_result)

        # Act
        result = adapter.format_event(event)

        # Assert
        assert result.startswith('a:')
        assert '"toolCallId":"call_abc123"' in result
        assert '"toolName":"get_weather"' in result
        assert '"result":' in result
        assert '"temperature"' in result and '72' in result
        assert result.endswith('\n')

    def test_format_completion_finished(self, adapter):
        """Test formatting completion finished event"""
        # Arrange
        usage = UsageStats(prompt_tokens=100, completion_tokens=50, total_tokens=150)
        event = CompletionFinished(finish_reason="stop", usage=usage)

        # Act
        result = adapter.format_event(event)

        # Assert
        assert result.startswith('e:')
        assert '"finishReason":"stop"' in result
        assert '"promptTokens":100' in result
        assert '"completionTokens":50' in result
        assert '"isContinued":false' in result
        assert result.endswith('\n')

    def test_format_tool_call_started_returns_empty_string(self, adapter):
        """Test that ToolCallStarted events are skipped (not sent to client)"""
        # Arrange
        event = ToolCallStarted(call_id="call_123", tool_name="test")

        # Act
        result = adapter.format_event(event)

        # Assert
        assert result == ''

    def test_format_tool_call_argument_chunk_returns_empty_string(self, adapter):
        """Test that ToolCallArgumentChunk events are skipped (not sent to client)"""
        # Arrange
        event = ToolCallArgumentChunk(call_id="call_123", arguments_chunk='{"a":')

        # Act
        result = adapter.format_event(event)

        # Assert
        assert result == ''

    def test_format_event_with_special_characters(self, adapter):
        """Test formatting events with special characters"""
        # Arrange
        event = TextDelta(content='Text with "quotes" and \\backslashes')

        # Act
        result = adapter.format_event(event)

        # Assert
        assert '0:' in result
        # JSON encoding should escape special characters
        parsed = json.loads(result[2:-1])  # Remove '0:' prefix and '\n' suffix
        assert parsed == 'Text with "quotes" and \\backslashes'

    def test_format_event_with_unicode(self, adapter):
        """Test formatting events with unicode characters"""
        # Arrange
        event = TextDelta(content="Hello 👋 世界")

        # Act
        result = adapter.format_event(event)

        # Assert
        assert '0:' in result
        assert result.endswith('\n')
