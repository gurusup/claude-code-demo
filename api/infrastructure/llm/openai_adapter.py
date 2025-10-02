# ABOUTME: OpenAI adapter implementing ILLMProvider port for OpenAI chat completions
# ABOUTME: Converts between domain entities and OpenAI SDK types, handles streaming
from typing import AsyncIterator, List
import json
from openai import AsyncOpenAI
from ...domain.ports.llm_provider import (
    ILLMProvider, LLMEvent, LLMTextDelta, LLMToolCallDelta, LLMFinished
)
from ...domain.entities.message import Message, MessageRole, Attachment
from ...domain.entities.tool import ITool
from ...domain.exceptions import LLMProviderError, RateLimitError


class OpenAILLMAdapter(ILLMProvider):
    """OpenAI implementation of ILLMProvider port"""

    def __init__(self, api_key: str):
        self._client = AsyncOpenAI(api_key=api_key)

    async def stream_completion(
        self,
        messages: List[Message],
        tools: List[ITool],
        model: str = "gpt-4o"
    ) -> AsyncIterator[LLMEvent]:
        """Convert domain messages to OpenAI format and stream"""

        try:
            # Convert domain messages to OpenAI format
            openai_messages = self._convert_messages(messages)

            # Convert domain tools to OpenAI format
            openai_tools = [self._convert_tool(tool) for tool in tools]

            # Stream from OpenAI
            stream = await self._client.chat.completions.create(
                model=model,
                messages=openai_messages,
                tools=openai_tools if openai_tools else None,
                stream=True,
                stream_options={"include_usage": True}
            )

            # Convert OpenAI chunks to LLMEvent objects
            async for chunk in stream:
                for choice in chunk.choices:
                    # Text delta
                    if choice.delta.content:
                        yield LLMTextDelta(content=choice.delta.content)

                    # Tool call delta
                    if choice.delta.tool_calls:
                        for tool_call in choice.delta.tool_calls:
                            yield LLMToolCallDelta(
                                index=tool_call.index,
                                id=tool_call.id,
                                name=tool_call.function.name if tool_call.function else None,
                                arguments_chunk=tool_call.function.arguments if tool_call.function else None
                            )

                    # Skip finish without usage
                    if choice.finish_reason and not chunk.usage:
                        continue

                # Usage info (final chunk)
                if chunk.usage:
                    finish_reason = chunk.choices[0].finish_reason if chunk.choices else "stop"
                    yield LLMFinished(
                        finish_reason=finish_reason,
                        prompt_tokens=chunk.usage.prompt_tokens,
                        completion_tokens=chunk.usage.completion_tokens
                    )

        except Exception as e:
            # Map OpenAI errors to domain exceptions
            if "rate_limit" in str(e).lower():
                raise RateLimitError(str(e))
            raise LLMProviderError(f"OpenAI error: {str(e)}")

    def _convert_messages(self, messages: List[Message]) -> List[dict]:
        """Convert domain Message to OpenAI ChatCompletionMessageParam"""
        openai_messages = []

        for msg in messages:
            if msg.role == MessageRole.TOOL:
                # Tool response message
                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id,
                    "content": msg.content
                })
            elif msg.role == MessageRole.ASSISTANT and msg.tool_calls:
                # Assistant message with tool calls
                openai_msg = {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": json.dumps(tc.arguments) if not isinstance(tc.arguments, str) else tc.arguments
                            }
                        }
                        for tc in msg.tool_calls
                    ]
                }
                # Add content if present
                if msg.content:
                    openai_msg["content"] = msg.content
                openai_messages.append(openai_msg)
            else:
                # Regular message
                content_parts = [{"type": "text", "text": msg.content}]

                # Add attachments
                for attachment in msg.attachments:
                    if attachment.content_type.startswith("image"):
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {"url": attachment.url}
                        })

                openai_messages.append({
                    "role": msg.role.value,
                    "content": content_parts
                })

        return openai_messages

    def _convert_tool(self, tool: ITool) -> dict:
        """Convert domain ITool to OpenAI tool format"""
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema.model_json_schema()
            }
        }
