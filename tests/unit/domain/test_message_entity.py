# ABOUTME: Unit tests for domain Message entity and related value objects
# ABOUTME: Tests validation, business rules, immutability, and edge cases for messages and attachments
import pytest
from dataclasses import FrozenInstanceError

from api.domain.entities.message import Message, MessageRole, Attachment


class TestMessageRole:
    """Tests for MessageRole enum"""

    def test_all_roles_exist(self):
        """Test that all expected roles are defined"""
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"
        assert MessageRole.TOOL.value == "tool"

    def test_from_string(self):
        """Test creating role from string value"""
        role = MessageRole("assistant")
        assert role == MessageRole.ASSISTANT

    def test_invalid_role_raises_error(self):
        """Test that invalid role string raises ValueError"""
        with pytest.raises(ValueError):
            MessageRole("invalid_role")


class TestAttachment:
    """Tests for Attachment value object"""

    def test_create_attachment_successfully(self):
        """Test creating a valid attachment"""
        # Arrange & Act
        attachment = Attachment(
            content_type="image/png",
            url="https://example.com/image.png"
        )

        # Assert
        assert attachment.content_type == "image/png"
        assert attachment.url == "https://example.com/image.png"

    def test_attachment_with_empty_content_type_raises_error(self):
        """Test that empty content_type raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="content_type cannot be empty"):
            Attachment(content_type="", url="https://example.com/file.txt")

    def test_attachment_with_empty_url_raises_error(self):
        """Test that empty URL raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="url cannot be empty"):
            Attachment(content_type="text/plain", url="")

    def test_attachment_is_immutable(self):
        """Test that Attachment is immutable (frozen dataclass)"""
        # Arrange
        attachment = Attachment(content_type="image/png", url="https://example.com/img.png")

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            attachment.content_type = "image/jpg"

    @pytest.mark.parametrize("content_type,url", [
        ("image/jpeg", "https://cdn.example.com/photo.jpg"),
        ("text/plain", "https://storage.example.com/document.txt"),
        ("application/pdf", "https://files.example.com/report.pdf"),
        ("image/png; charset=utf-8", "https://example.com/img.png"),  # With charset
    ])
    def test_attachment_with_various_valid_inputs(self, content_type, url):
        """Test attachment creation with various valid inputs"""
        attachment = Attachment(content_type=content_type, url=url)
        assert attachment.content_type == content_type
        assert attachment.url == url


class TestMessage:
    """Tests for Message domain entity"""

    def test_create_user_message_successfully(self):
        """Test creating a valid user message"""
        # Arrange & Act
        message = Message(
            role=MessageRole.USER,
            content="Hello, AI!"
        )

        # Assert
        assert message.role == MessageRole.USER
        assert message.content == "Hello, AI!"
        assert message.attachments == []
        assert message.tool_call_id is None

    def test_create_assistant_message_successfully(self):
        """Test creating a valid assistant message"""
        # Arrange & Act
        message = Message(
            role=MessageRole.ASSISTANT,
            content="Hello, how can I help you?"
        )

        # Assert
        assert message.role == MessageRole.ASSISTANT
        assert message.content == "Hello, how can I help you?"

    def test_create_system_message_successfully(self):
        """Test creating a valid system message"""
        # Arrange & Act
        message = Message(
            role=MessageRole.SYSTEM,
            content="You are a helpful assistant."
        )

        # Assert
        assert message.role == MessageRole.SYSTEM
        assert message.content == "You are a helpful assistant."

    def test_create_tool_message_with_tool_call_id_successfully(self):
        """Test creating a valid tool response message"""
        # Arrange & Act
        message = Message(
            role=MessageRole.TOOL,
            content='{"temperature": 72}',
            tool_call_id="call_abc123"
        )

        # Assert
        assert message.role == MessageRole.TOOL
        assert message.content == '{"temperature": 72}'
        assert message.tool_call_id == "call_abc123"

    def test_message_with_empty_content_raises_error(self):
        """Test that empty content raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="Message content cannot be empty"):
            Message(role=MessageRole.USER, content="")

    def test_tool_message_without_tool_call_id_raises_error(self):
        """Test that tool messages without tool_call_id raise ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="Tool messages must have tool_call_id"):
            Message(
                role=MessageRole.TOOL,
                content="Weather data",
                tool_call_id=None
            )

    def test_message_with_attachments(self):
        """Test creating message with attachments"""
        # Arrange
        attachment1 = Attachment(
            content_type="image/png",
            url="https://example.com/img1.png"
        )
        attachment2 = Attachment(
            content_type="image/jpeg",
            url="https://example.com/img2.jpg"
        )

        # Act
        message = Message(
            role=MessageRole.USER,
            content="Check these images",
            attachments=[attachment1, attachment2]
        )

        # Assert
        assert len(message.attachments) == 2
        assert message.attachments[0].content_type == "image/png"
        assert message.attachments[1].content_type == "image/jpeg"

    def test_message_is_immutable(self):
        """Test that Message is immutable (frozen dataclass)"""
        # Arrange
        message = Message(role=MessageRole.USER, content="Test")

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            message.content = "Modified"

    def test_is_tool_response_returns_true_for_tool_message(self):
        """Test is_tool_response() returns True for tool messages"""
        # Arrange
        message = Message(
            role=MessageRole.TOOL,
            content="Result",
            tool_call_id="call_123"
        )

        # Act & Assert
        assert message.is_tool_response() is True

    def test_is_tool_response_returns_false_for_user_message(self):
        """Test is_tool_response() returns False for user messages"""
        # Arrange
        message = Message(role=MessageRole.USER, content="Hello")

        # Act & Assert
        assert message.is_tool_response() is False

    def test_has_attachments_returns_true_when_attachments_present(self):
        """Test has_attachments() returns True when attachments exist"""
        # Arrange
        attachment = Attachment(
            content_type="image/png",
            url="https://example.com/img.png"
        )
        message = Message(
            role=MessageRole.USER,
            content="Image",
            attachments=[attachment]
        )

        # Act & Assert
        assert message.has_attachments() is True

    def test_has_attachments_returns_false_when_no_attachments(self):
        """Test has_attachments() returns False when no attachments"""
        # Arrange
        message = Message(role=MessageRole.USER, content="Text only")

        # Act & Assert
        assert message.has_attachments() is False

    @pytest.mark.parametrize("role,content,tool_call_id,should_raise", [
        (MessageRole.USER, "Hello", None, False),
        (MessageRole.ASSISTANT, "Response", None, False),
        (MessageRole.SYSTEM, "System prompt", None, False),
        (MessageRole.TOOL, "Result", "call_123", False),
        (MessageRole.TOOL, "Result", None, True),  # Missing tool_call_id
        (MessageRole.USER, "", None, True),  # Empty content
        (MessageRole.ASSISTANT, "", None, False),  # Empty content allowed for assistant (tool calls)
    ])
    def test_message_validation_parametrized(self, role, content, tool_call_id, should_raise):
        """Parametrized test for message validation rules"""
        if should_raise:
            with pytest.raises(ValueError):
                Message(
                    role=role,
                    content=content,
                    tool_call_id=tool_call_id
                )
        else:
            message = Message(
                role=role,
                content=content,
                tool_call_id=tool_call_id
            )
            assert message.role == role
            assert message.content == content

    def test_message_with_unicode_content(self):
        """Test message with unicode and emoji content"""
        # Arrange & Act
        message = Message(
            role=MessageRole.USER,
            content="Hello 👋 世界 🌍"
        )

        # Assert
        assert message.content == "Hello 👋 世界 🌍"
        assert "👋" in message.content

    def test_message_with_very_long_content(self):
        """Test message with very long content"""
        # Arrange
        long_content = "x" * 100000  # 100k characters

        # Act
        message = Message(role=MessageRole.USER, content=long_content)

        # Assert
        assert len(message.content) == 100000

    def test_message_with_multiline_content(self):
        """Test message with multiline content"""
        # Arrange
        multiline_content = """This is line 1
        This is line 2
        This is line 3"""

        # Act
        message = Message(role=MessageRole.USER, content=multiline_content)

        # Assert
        assert "\n" in message.content
        assert message.content.count("\n") == 2

    def test_user_message_can_have_tool_call_id_none(self):
        """Test that non-tool messages can have tool_call_id as None"""
        # Arrange & Act
        message = Message(
            role=MessageRole.USER,
            content="Hello",
            tool_call_id=None
        )

        # Assert
        assert message.tool_call_id is None

    def test_message_equality(self):
        """Test that messages with same content are equal"""
        # Arrange
        message1 = Message(role=MessageRole.USER, content="Hello")
        message2 = Message(role=MessageRole.USER, content="Hello")

        # Act & Assert
        assert message1 == message2

    def test_message_inequality(self):
        """Test that messages with different content are not equal"""
        # Arrange
        message1 = Message(role=MessageRole.USER, content="Hello")
        message2 = Message(role=MessageRole.USER, content="Goodbye")

        # Act & Assert
        assert message1 != message2
