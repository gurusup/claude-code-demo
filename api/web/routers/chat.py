# ABOUTME: Chat router handling /api/chat endpoint for streaming chat completions
# ABOUTME: Converts web DTOs to domain entities, delegates to use case, formats responses
from typing import List, AsyncIterator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ...application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from ...infrastructure.protocol.vercel_stream import VercelStreamProtocolAdapter
from ..dtos.client_messages import ClientMessage
from..mappers.message_mapper import MessageMapper

router = APIRouter()


class ChatRequest(BaseModel):
    """HTTP request model for chat endpoint"""
    messages: List[ClientMessage]


def create_chat_handler(use_case: StreamChatCompletionUseCase):
    """Factory function to create chat handler with injected dependencies"""

    @router.post("/api/chat")
    async def handle_chat(request: ChatRequest):
        """
        Handle streaming chat completion requests.

        Converts ClientMessages to domain Messages, executes use case,
        and formats StreamEvents as Data Stream Protocol v1.
        """
        # Convert DTOs to domain entities
        domain_messages = MessageMapper.to_domain(request.messages)

        # Stream events generator
        async def stream_events() -> AsyncIterator[str]:
            async for event in use_case.execute(domain_messages):
                # Convert domain event to protocol string
                protocol_string = VercelStreamProtocolAdapter.format_event(event)
                if protocol_string:
                    yield protocol_string

        # Return streaming response
        response = StreamingResponse(stream_events(), media_type="text/event-stream")
        response.headers['x-vercel-ai-data-stream'] = 'v1'
        return response

    return handle_chat
