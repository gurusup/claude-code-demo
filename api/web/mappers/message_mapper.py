# ABOUTME: Message mapper converting between ClientMessage DTOs and domain Message entities
# ABOUTME: Handles tool invocations and attachments, expanding single ClientMessage to multiple Messages
import json
from typing import List
from ...domain.entities.message import Message, MessageRole, Attachment
from ...domain.entities.tool import ToolCall
from ..dtos.client_messages import ClientMessage, ToolInvocation, ToolInvocationState


class MessageMapper:
    """Maps between web DTOs and domain entities"""

    @staticmethod
    def to_domain(client_messages: List[ClientMessage]) -> List[Message]:
        """
        Convert ClientMessage list to domain Message list.

        May return more messages than input due to tool invocations being expanded.
        """
        messages = []

        for client_message in client_messages:
            # Main message with attachments
            attachments = []
            if client_message.experimental_attachments:
                for att in client_message.experimental_attachments:
                    attachments.append(Attachment(
                        content_type=att.contentType,
                        url=att.url
                    ))

            # Extract tool calls from CALL state invocations (for assistant messages)
            tool_calls = None
            if client_message.toolInvocations and client_message.role == "assistant":
                tool_calls = []
                for invocation in client_message.toolInvocations:
                    # Create tool call from either CALL or RESULT state
                    if invocation.state in [ToolInvocationState.CALL, ToolInvocationState.RESULT]:
                        tool_calls.append(ToolCall(
                            id=invocation.toolCallId,
                            name=invocation.toolName,
                            arguments=invocation.args
                        ))

            # Add main message
            messages.append(Message(
                role=MessageRole(client_message.role),
                content=client_message.content,
                attachments=attachments,
                tool_calls=tool_calls if tool_calls else None
            ))

            # Add tool result messages if present
            if client_message.toolInvocations:
                for invocation in client_message.toolInvocations:
                    if invocation.state == ToolInvocationState.RESULT:
                        messages.append(Message(
                            role=MessageRole.TOOL,
                            content=json.dumps(invocation.result),
                            tool_call_id=invocation.toolCallId
                        ))

        return messages
