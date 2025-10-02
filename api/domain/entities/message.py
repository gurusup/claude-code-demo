# ABOUTME: Message entity representing chat messages in the domain model
# ABOUTME: Provides validation for message content, roles, and attachments using frozen dataclasses
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .tool import ToolCall


class MessageRole(str, Enum):
    """Message role enum defining valid message types"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


@dataclass(frozen=True)
class Attachment:
    """Domain representation of message attachment"""
    content_type: str
    url: str

    def __post_init__(self):
        if not self.content_type:
            raise ValueError("content_type cannot be empty")
        if not self.url:
            raise ValueError("url cannot be empty")


@dataclass(frozen=True)
class Message:
    """Domain entity representing a chat message"""
    role: MessageRole
    content: str
    attachments: List[Attachment] = field(default_factory=list)
    tool_call_id: Optional[str] = None  # For tool response messages
    tool_calls: Optional[List['ToolCall']] = None  # For assistant messages with tool calls

    def __post_init__(self):
        # Allow empty content for assistant messages (tool calls without text)
        # but require content for user, system, and tool messages
        if not self.content and self.role != MessageRole.ASSISTANT:
            raise ValueError("Message content cannot be empty")
        if self.role == MessageRole.TOOL and not self.tool_call_id:
            raise ValueError("Tool messages must have tool_call_id")

    def is_tool_response(self) -> bool:
        """Check if this is a tool response message"""
        return self.role == MessageRole.TOOL

    def has_attachments(self) -> bool:
        """Check if this message has attachments"""
        return len(self.attachments) > 0
