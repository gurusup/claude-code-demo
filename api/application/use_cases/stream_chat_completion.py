# ABOUTME: Stream chat completion use case orchestrating LLM streaming and tool execution
# ABOUTME: Converts LLMEvents to domain StreamEvents and manages tool call accumulation
from typing import AsyncIterator, List, Dict
import json
from ...domain.entities.message import Message
from ...domain.entities.events import (
    StreamEvent, TextDelta, ToolCallStarted, ToolCallArgumentChunk,
    ToolCallCompleted, ToolResultAvailable, CompletionFinished, UsageStats
)
from ...domain.entities.tool import ToolCall
from ...domain.ports.llm_provider import ILLMProvider, LLMEvent, LLMTextDelta, LLMToolCallDelta, LLMFinished
from ...domain.ports.tool_executor import IToolExecutor


class StreamChatCompletionUseCase:
    """
    Orchestrates streaming chat completion with tool execution.

    Responsibility:
    - Accept domain messages
    - Stream from LLM provider
    - Accumulate tool calls
    - Execute tools when complete
    - Yield domain StreamEvent objects
    """

    def __init__(
        self,
        llm_provider: ILLMProvider,
        tool_executor: IToolExecutor
    ):
        self._llm_provider = llm_provider
        self._tool_executor = tool_executor

    async def execute(self, messages: List[Message]) -> AsyncIterator[StreamEvent]:
        """
        Execute streaming chat completion.

        Args:
            messages: Domain message history

        Yields:
            StreamEvent objects (TextDelta, ToolCall*, CompletionFinished)
        """
        # Get registered tools
        tools = self._tool_executor.get_registered_tools()

        # Track tool calls as they stream in
        tool_calls_in_progress: Dict[int, Dict[str, str]] = {}

        # Stream from LLM provider
        async for event in self._llm_provider.stream_completion(messages, tools):

            if isinstance(event, LLMTextDelta):
                # Yield text content
                yield TextDelta(content=event.content)

            elif isinstance(event, LLMToolCallDelta):
                # Accumulate tool call
                if event.id is not None:
                    # New tool call started
                    tool_calls_in_progress[event.index] = {
                        'id': event.id,
                        'name': event.name or '',
                        'arguments': ''
                    }
                    yield ToolCallStarted(
                        call_id=event.id,
                        tool_name=event.name or ''
                    )

                if event.arguments_chunk:
                    # Accumulate arguments
                    tool_calls_in_progress[event.index]['arguments'] += event.arguments_chunk
                    yield ToolCallArgumentChunk(
                        call_id=tool_calls_in_progress[event.index]['id'],
                        arguments_chunk=event.arguments_chunk
                    )

            elif isinstance(event, LLMFinished):
                # Tool calls complete - execute them
                if tool_calls_in_progress:
                    for tool_data in tool_calls_in_progress.values():
                        # Parse arguments and create ToolCall
                        tool_call = ToolCall(
                            id=tool_data['id'],
                            name=tool_data['name'],
                            arguments=json.loads(tool_data['arguments'])
                        )

                        yield ToolCallCompleted(tool_call=tool_call)

                        # Execute tool
                        tool_result = await self._tool_executor.execute(tool_call)
                        yield ToolResultAvailable(tool_result=tool_result)

                # Yield completion
                yield CompletionFinished(
                    finish_reason=event.finish_reason,
                    usage=UsageStats(
                        prompt_tokens=event.prompt_tokens,
                        completion_tokens=event.completion_tokens,
                        total_tokens=event.prompt_tokens + event.completion_tokens
                    )
                )
