# ABOUTME: Vercel Stream Protocol adapter converting domain events to Data Stream Protocol v1
# ABOUTME: Formats StreamEvents as protocol strings with specific format codes (0:, 9:, a:, e:)
import json
from typing import Iterator
from ...domain.entities.events import (
    StreamEvent, TextDelta, ToolCallStarted, ToolCallArgumentChunk,
    ToolCallCompleted, ToolResultAvailable, CompletionFinished
)


class VercelStreamProtocolAdapter:
    """Converts domain StreamEvent to Vercel Data Stream Protocol v1"""

    @staticmethod
    def format_event(event: StreamEvent) -> str:
        """
        Convert domain event to protocol string.

        Protocol format codes:
        - 0: text delta
        - 9: tool call invocation
        - a: tool result
        - e: completion finished
        """

        if isinstance(event, TextDelta):
            return f'0:{json.dumps(event.content)}\n'

        elif isinstance(event, ToolCallCompleted):
            # Tool call with complete arguments
            return (
                f'9:{{"toolCallId":"{event.tool_call.id}",'
                f'"toolName":"{event.tool_call.name}",'
                f'"args":{json.dumps(event.tool_call.arguments)}}}\n'
            )

        elif isinstance(event, ToolResultAvailable):
            # Tool execution result
            return (
                f'a:{{"toolCallId":"{event.tool_result.call_id}",'
                f'"toolName":"{event.tool_result.name}",'
                f'"result":{json.dumps(event.tool_result.result)}}}\n'
            )

        elif isinstance(event, CompletionFinished):
            # Final event with usage
            return (
                f'e:{{"finishReason":"{event.finish_reason}",'
                f'"usage":{{"promptTokens":{event.usage.prompt_tokens},'
                f'"completionTokens":{event.usage.completion_tokens}}},'
                f'"isContinued":false}}\n'
            )

        # Skip events we don't send to client (ToolCallStarted, ToolCallArgumentChunk)
        return ''
