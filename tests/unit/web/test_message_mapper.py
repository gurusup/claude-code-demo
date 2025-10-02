# ABOUTME: Unit tests for MessageMapper
# ABOUTME: Tests bidirectional conversion between ClientMessage DTOs and domain Message entities
import pytest
import json

from api.web.mappers.message_mapper import MessageMapper
from api.web.dtos.client_messages import ClientMessage, ClientAttachment, ToolInvocation, ToolInvocationState
from api.domain.entities.message import Message, MessageRole, Attachment


class TestMessageMapper:
    """Tests for MessageMapper"""

    def test_to_domain_simple_user_message(self):
        """Test mapping simple user message"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="user",
                content="Hello, AI!",
                experimental_attachments=None,
                toolInvocations=None
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 1
        assert domain_messages[0].role == MessageRole.USER
        assert domain_messages[0].content == "Hello, AI!"
        assert domain_messages[0].attachments == []

    def test_to_domain_assistant_message(self):
        """Test mapping assistant message"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="assistant",
                content="Hello! How can I help?",
                experimental_attachments=None,
                toolInvocations=None
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 1
        assert domain_messages[0].role == MessageRole.ASSISTANT
        assert domain_messages[0].content == "Hello! How can I help?"

    def test_to_domain_system_message(self):
        """Test mapping system message"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="system",
                content="You are a helpful assistant.",
                experimental_attachments=None,
                toolInvocations=None
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 1
        assert domain_messages[0].role == MessageRole.SYSTEM

    def test_to_domain_message_with_attachments(self):
        """Test mapping message with attachments"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="user",
                content="Check these images",
                experimental_attachments=[
                    ClientAttachment(
                        contentType="image/png",
                        url="https://example.com/img1.png"
                    ),
                    ClientAttachment(
                        contentType="image/jpeg",
                        url="https://example.com/img2.jpg"
                    )
                ],
                toolInvocations=None
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 1
        assert len(domain_messages[0].attachments) == 2
        assert domain_messages[0].attachments[0].content_type == "image/png"
        assert domain_messages[0].attachments[0].url == "https://example.com/img1.png"
        assert domain_messages[0].attachments[1].content_type == "image/jpeg"

    def test_to_domain_message_with_tool_invocations(self):
        """Test mapping message with tool result invocations"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="assistant",
                content="I checked the weather",
                experimental_attachments=None,
                toolInvocations=[
                    ToolInvocation(
                        state=ToolInvocationState.RESULT,
                        toolCallId="call_abc123",
                        toolName="get_weather",
                        args={"city": "SF"},
                        result={"temperature": 72, "conditions": "sunny"}
                    )
                ]
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 2  # Original message + tool result message

        # Check assistant message
        assert domain_messages[0].role == MessageRole.ASSISTANT
        assert domain_messages[0].content == "I checked the weather"

        # Check tool result message
        assert domain_messages[1].role == MessageRole.TOOL
        assert domain_messages[1].tool_call_id == "call_abc123"
        result = json.loads(domain_messages[1].content)
        assert result["temperature"] == 72
        assert result["conditions"] == "sunny"

    def test_to_domain_skips_non_result_tool_invocations(self):
        """Test that non-result tool invocations are skipped"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="assistant",
                content="Calling tool",
                experimental_attachments=None,
                toolInvocations=[
                    ToolInvocation(
                        state=ToolInvocationState.CALL,
                        toolCallId="call_123",
                        toolName="test",
                        args={},
                        result=None
                    ),
                    ToolInvocation(
                        state=ToolInvocationState.PARTIAL_CALL,
                        toolCallId="call_456",
                        toolName="test",
                        args={},
                        result=None
                    )
                ]
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 1  # Only the assistant message, no tool results

    def test_to_domain_multiple_messages(self):
        """Test mapping multiple client messages"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="system",
                content="You are helpful",
                experimental_attachments=None,
                toolInvocations=None
            ),
            ClientMessage(
                role="user",
                content="Hello",
                experimental_attachments=None,
                toolInvocations=None
            ),
            ClientMessage(
                role="assistant",
                content="Hi there!",
                experimental_attachments=None,
                toolInvocations=None
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 3
        assert domain_messages[0].role == MessageRole.SYSTEM
        assert domain_messages[1].role == MessageRole.USER
        assert domain_messages[2].role == MessageRole.ASSISTANT

    def test_to_domain_empty_list(self):
        """Test mapping empty message list"""
        # Arrange
        client_messages = []

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert domain_messages == []

    def test_to_domain_message_with_multiple_tool_results(self):
        """Test mapping message with multiple tool result invocations"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="assistant",
                content="Checked multiple things",
                experimental_attachments=None,
                toolInvocations=[
                    ToolInvocation(
                        state=ToolInvocationState.RESULT,
                        toolCallId="call_1",
                        toolName="tool1",
                        args={},
                        result={"data": 1}
                    ),
                    ToolInvocation(
                        state=ToolInvocationState.RESULT,
                        toolCallId="call_2",
                        toolName="tool2",
                        args={},
                        result={"data": 2}
                    )
                ]
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert len(domain_messages) == 3  # 1 assistant + 2 tool results

        assert domain_messages[1].role == MessageRole.TOOL
        assert domain_messages[1].tool_call_id == "call_1"

        assert domain_messages[2].role == MessageRole.TOOL
        assert domain_messages[2].tool_call_id == "call_2"

    def test_to_domain_preserves_message_order(self):
        """Test that message order is preserved"""
        # Arrange
        client_messages = [
            ClientMessage(role="user", content="First", experimental_attachments=None, toolInvocations=None),
            ClientMessage(role="assistant", content="Second", experimental_attachments=None, toolInvocations=None),
            ClientMessage(role="user", content="Third", experimental_attachments=None, toolInvocations=None),
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert domain_messages[0].content == "First"
        assert domain_messages[1].content == "Second"
        assert domain_messages[2].content == "Third"

    def test_to_domain_with_unicode_content(self):
        """Test mapping message with unicode content"""
        # Arrange
        client_messages = [
            ClientMessage(
                role="user",
                content="Hello 👋 世界",
                experimental_attachments=None,
                toolInvocations=None
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        assert domain_messages[0].content == "Hello 👋 世界"

    def test_to_domain_tool_result_json_serialization(self):
        """Test that tool results are properly JSON serialized"""
        # Arrange
        complex_result = {
            "nested": {"data": [1, 2, 3]},
            "string": "value",
            "number": 42,
            "boolean": True
        }
        client_messages = [
            ClientMessage(
                role="assistant",
                content="Done",
                experimental_attachments=None,
                toolInvocations=[
                    ToolInvocation(
                        state=ToolInvocationState.RESULT,
                        toolCallId="call_123",
                        toolName="test",
                        args={},
                        result=complex_result
                    )
                ]
            )
        ]

        # Act
        domain_messages = MessageMapper.to_domain(client_messages)

        # Assert
        tool_message = domain_messages[1]
        deserialized = json.loads(tool_message.content)
        assert deserialized == complex_result
