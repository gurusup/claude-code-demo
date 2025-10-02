# ABOUTME: LLM provider port defining the contract for LLM service adapters
# ABOUTME: Defines LLMEvent types for provider-to-usecase communication and ILLMProvider interface
from abc import ABC, abstractmethod
from typing import AsyncIterator, List, Optional
from dataclasses import dataclass
from ..entities.message import Message
from ..entities.tool import ITool


@dataclass(frozen=True)
class LLMTextDelta:
    """Text content delta from LLM provider"""
    content: str


@dataclass(frozen=True)
class LLMToolCallDelta:
    """Tool call delta from LLM provider"""
    index: int
    id: Optional[str] = None
    name: Optional[str] = None
    arguments_chunk: Optional[str] = None


@dataclass(frozen=True)
class LLMFinished:
    """LLM completion finished with usage stats"""
    finish_reason: str
    prompt_tokens: int
    completion_tokens: int


# Union type for LLM events
LLMEvent = LLMTextDelta | LLMToolCallDelta | LLMFinished


class ILLMProvider(ABC):
    """Port for LLM provider adapters"""

    @abstractmethod
    async def stream_completion(
        self,
        messages: List[Message],
        tools: List[ITool],
        model: str = "gpt-4o"
    ) -> AsyncIterator[LLMEvent]:
        """
        Stream chat completion from LLM provider.

        Yields LLMEvent objects (internal to port contract).
        Use case converts these to public StreamEvent objects.

        Args:
            messages: Domain message history
            tools: Available tools for the LLM
            model: Model identifier

        Yields:
            LLMEvent objects representing streaming chunks

        Raises:
            LLMProviderError: On provider-specific errors
            RateLimitError: When rate limited
        """
        pass
