# ABOUTME: Stream event entities representing domain events during chat completion streaming
# ABOUTME: Event-based model separates domain logic from protocol formatting concerns
from dataclasses import dataclass
from abc import ABC
from typing import Any
from .tool import ToolCall, ToolResult


class StreamEvent(ABC):
    """Base class for all streaming events - domain concept"""
    pass


@dataclass(frozen=True)
class TextDelta(StreamEvent):
    """Incremental text content"""
    content: str


@dataclass(frozen=True)
class ToolCallStarted(StreamEvent):
    """Tool call initiated"""
    call_id: str
    tool_name: str


@dataclass(frozen=True)
class ToolCallArgumentChunk(StreamEvent):
    """Incremental tool arguments"""
    call_id: str
    arguments_chunk: str


@dataclass(frozen=True)
class ToolCallCompleted(StreamEvent):
    """Tool call with complete arguments"""
    tool_call: ToolCall


@dataclass(frozen=True)
class ToolResultAvailable(StreamEvent):
    """Tool execution result"""
    tool_result: ToolResult


@dataclass(frozen=True)
class UsageStats:
    """Token usage statistics"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass(frozen=True)
class CompletionFinished(StreamEvent):
    """Streaming completed"""
    finish_reason: str  # "stop" | "tool_calls" | "length" | "content_filter"
    usage: UsageStats
