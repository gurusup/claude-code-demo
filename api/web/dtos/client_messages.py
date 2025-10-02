# ABOUTME: Client message DTOs matching the frontend AI SDK message format
# ABOUTME: Maintains backward compatibility with existing frontend contracts
from enum import Enum
from pydantic import BaseModel
from typing import List, Optional, Any


class ClientAttachment(BaseModel):
    """Frontend attachment model"""
    contentType: str
    url: str


class ToolInvocationState(str, Enum):
    """Tool invocation state enum"""
    CALL = 'call'
    PARTIAL_CALL = 'partial-call'
    RESULT = 'result'


class ToolInvocation(BaseModel):
    """Frontend tool invocation model"""
    state: ToolInvocationState
    toolCallId: str
    toolName: str
    args: Any
    result: Any


class ClientMessage(BaseModel):
    """Frontend message model matching AI SDK format"""
    role: str
    content: str
    experimental_attachments: Optional[List[ClientAttachment]] = None
    toolInvocations: Optional[List[ToolInvocation]] = None
