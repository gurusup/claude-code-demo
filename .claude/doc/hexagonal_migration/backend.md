# Hexagonal Architecture Implementation Plan - Backend

## Executive Summary

This document provides detailed architectural guidance for migrating the FastAPI chat completion API from procedural code to hexagonal architecture. The plan corrects several misconceptions in the initial proposal and provides concrete implementation patterns.

## Critical Architectural Corrections

### 1. Streaming is Infrastructure, NOT Domain

**❌ WRONG - Original Plan:**
- `StreamChunk` as domain entity
- Use case yields protocol-specific strings ("0:", "9:", etc.)

**✅ CORRECT - Revised Plan:**
- Domain uses **event-based model** with `StreamEvent` base class
- Infrastructure layer converts domain events to Vercel Data Stream Protocol
- Use case orchestrates domain events, not streaming formats

### 2. Tool System Architecture

**❌ WRONG - Original Plan:**
- `IToolRepository` - treating tools as stored data

**✅ CORRECT - Revised Plan:**
- `IToolExecutor` - port for executing tools by name/args
- `ITool` - domain interface for tool implementations
- Tools are executable objects, not data to be retrieved

### 3. Layer Responsibilities

**❌ WRONG - Original Plan:**
- `ConvertMessagesUseCase` - message conversion as a use case
- Use case knows about OpenAI message format

**✅ CORRECT - Revised Plan:**
- Message conversion is **mapper responsibility** (infrastructure)
- Use cases only work with domain entities
- OpenAI specifics isolated to `OpenAILLMAdapter`

## Domain Layer Design

### Core Entities

#### 1. Message Entity (`api/domain/entities/message.py`)

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Any

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"

@dataclass
class Attachment:
    """Domain representation of message attachment"""
    content_type: str
    url: str

    def __post_init__(self):
        if not self.content_type:
            raise ValueError("content_type cannot be empty")
        if not self.url:
            raise ValueError("url cannot be empty")

@dataclass
class Message:
    """Domain entity representing a chat message"""
    role: MessageRole
    content: str
    attachments: List[Attachment] = field(default_factory=list)
    tool_call_id: Optional[str] = None  # For tool response messages

    def __post_init__(self):
        if not self.content:
            raise ValueError("Message content cannot be empty")
        if self.role == MessageRole.TOOL and not self.tool_call_id:
            raise ValueError("Tool messages must have tool_call_id")

    def is_tool_response(self) -> bool:
        return self.role == MessageRole.TOOL

    def has_attachments(self) -> bool:
        return len(self.attachments) > 0
```

#### 2. Tool Entities (`api/domain/entities/tool.py`)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pydantic import BaseModel
from typing import Any, Dict

class ToolInput(BaseModel):
    """Base class for all tool inputs - uses Pydantic for validation"""
    pass

@dataclass
class ToolCall:
    """Domain entity representing a tool invocation"""
    id: str
    name: str
    arguments: Dict[str, Any]

    def __post_init__(self):
        if not self.id:
            raise ValueError("ToolCall id cannot be empty")
        if not self.name:
            raise ValueError("ToolCall name cannot be empty")

@dataclass
class ToolResult:
    """Domain entity representing tool execution result"""
    call_id: str
    name: str
    result: Any

    def __post_init__(self):
        if not self.call_id:
            raise ValueError("ToolResult call_id cannot be empty")

class ITool(ABC):
    """Domain interface for tool implementations"""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tool identifier"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable tool description"""
        pass

    @property
    @abstractmethod
    def input_schema(self) -> type[ToolInput]:
        """Pydantic model defining tool inputs"""
        pass

    @abstractmethod
    async def execute(self, tool_input: ToolInput) -> Any:
        """Execute the tool with validated input"""
        pass
```

#### 3. Stream Events (`api/domain/entities/events.py`)

```python
from dataclasses import dataclass
from abc import ABC
from typing import Any, Optional
from .tool import ToolCall, ToolResult

class StreamEvent(ABC):
    """Base class for all streaming events - domain concept"""
    pass

@dataclass
class TextDelta(StreamEvent):
    """Incremental text content"""
    content: str

@dataclass
class ToolCallStarted(StreamEvent):
    """Tool call initiated"""
    call_id: str
    tool_name: str

@dataclass
class ToolCallArgumentChunk(StreamEvent):
    """Incremental tool arguments"""
    call_id: str
    arguments_chunk: str

@dataclass
class ToolCallCompleted(StreamEvent):
    """Tool call with complete arguments"""
    tool_call: ToolCall

@dataclass
class ToolResultAvailable(StreamEvent):
    """Tool execution result"""
    tool_result: ToolResult

@dataclass
class UsageStats:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

@dataclass
class CompletionFinished(StreamEvent):
    """Streaming completed"""
    finish_reason: str  # "stop" | "tool_calls" | "length" | "content_filter"
    usage: UsageStats
```

### Port Interfaces

#### 1. LLM Provider Port (`api/domain/ports/llm_provider.py`)

```python
from abc import ABC, abstractmethod
from typing import AsyncIterator, List
from dataclasses import dataclass
from ..entities.message import Message
from ..entities.tool import ITool

# Internal events for LLM provider - part of port contract
@dataclass
class LLMTextDelta:
    content: str

@dataclass
class LLMToolCallDelta:
    index: int
    id: Optional[str] = None
    name: Optional[str] = None
    arguments_chunk: Optional[str] = None

@dataclass
class LLMFinished:
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
```

#### 2. Tool Executor Port (`api/domain/ports/tool_executor.py`)

```python
from abc import ABC, abstractmethod
from typing import Any, Dict, List
from ..entities.tool import ITool, ToolCall, ToolResult

class IToolExecutor(ABC):
    """Port for tool execution"""

    @abstractmethod
    def register_tool(self, tool: ITool) -> None:
        """Register a tool for execution"""
        pass

    @abstractmethod
    async def execute(self, tool_call: ToolCall) -> ToolResult:
        """
        Execute a tool by name with arguments.

        Args:
            tool_call: ToolCall with name and arguments

        Returns:
            ToolResult with execution result

        Raises:
            ToolNotFoundError: If tool doesn't exist
            ToolExecutionError: If execution fails
        """
        pass

    @abstractmethod
    def get_registered_tools(self) -> List[ITool]:
        """Get all registered tools"""
        pass
```

#### 3. Weather Service Port (`api/domain/ports/weather_service.py`)

```python
from abc import ABC, abstractmethod
from typing import Dict, Any

class IWeatherService(ABC):
    """Port for weather data providers"""

    @abstractmethod
    async def get_weather(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Fetch current weather data.

        Args:
            latitude: Location latitude
            longitude: Location longitude

        Returns:
            Weather data dictionary

        Raises:
            WeatherServiceError: On API errors
        """
        pass
```

### Domain Exceptions (`api/domain/exceptions.py`)

```python
class DomainException(Exception):
    """Base exception for domain layer"""
    pass

class InvalidMessageError(DomainException):
    """Invalid message entity"""
    pass

class LLMProviderError(DomainException):
    """LLM provider error"""
    pass

class RateLimitError(LLMProviderError):
    """LLM provider rate limit exceeded"""
    pass

class ToolNotFoundError(DomainException):
    """Tool not found in registry"""
    pass

class ToolExecutionError(DomainException):
    """Tool execution failed"""
    def __init__(self, tool_name: str, original_error: Exception):
        self.tool_name = tool_name
        self.original_error = original_error
        super().__init__(f"Tool '{tool_name}' failed: {str(original_error)}")

class WeatherServiceError(DomainException):
    """Weather service error"""
    pass
```

## Application Layer Design

### Use Case Implementation (`api/application/use_cases/stream_chat_completion.py`)

```python
from typing import AsyncIterator, List
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
        tool_calls_in_progress: Dict[int, ToolCall] = {}

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
                        import json
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
```

## Infrastructure Layer Design

### OpenAI Adapter (`api/infrastructure/llm/openai_adapter.py`)

```python
from typing import AsyncIterator, List
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionChunk
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
                stream=True
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
```

### Tool Executor (`api/infrastructure/tools/tool_executor.py`)

```python
from typing import Dict, List
from ...domain.ports.tool_executor import IToolExecutor
from ...domain.entities.tool import ITool, ToolCall, ToolResult
from ...domain.exceptions import ToolNotFoundError, ToolExecutionError

class ToolExecutor(IToolExecutor):
    """Concrete implementation of IToolExecutor"""

    def __init__(self):
        self._tools: Dict[str, ITool] = {}

    def register_tool(self, tool: ITool) -> None:
        """Register a tool for execution"""
        self._tools[tool.name] = tool

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        """Execute tool by name with arguments"""
        if tool_call.name not in self._tools:
            raise ToolNotFoundError(f"Tool '{tool_call.name}' not registered")

        tool = self._tools[tool_call.name]

        try:
            # Validate and parse arguments using Pydantic
            tool_input = tool.input_schema(**tool_call.arguments)

            # Execute tool
            result = await tool.execute(tool_input)

            return ToolResult(
                call_id=tool_call.id,
                name=tool_call.name,
                result=result
            )
        except Exception as e:
            raise ToolExecutionError(tool_call.name, e)

    def get_registered_tools(self) -> List[ITool]:
        """Get all registered tools"""
        return list(self._tools.values())
```

### Weather Tool (`api/infrastructure/tools/weather_tool.py`)

```python
from pydantic import Field
from ...domain.entities.tool import ITool, ToolInput
from ...domain.ports.weather_service import IWeatherService
from typing import Any

class WeatherToolInput(ToolInput):
    """Pydantic model for weather tool input"""
    latitude: float = Field(description="The latitude of the location")
    longitude: float = Field(description="The longitude of the location")

class WeatherTool(ITool):
    """Weather tool implementation"""

    def __init__(self, weather_service: IWeatherService):
        self._weather_service = weather_service

    @property
    def name(self) -> str:
        return "get_current_weather"

    @property
    def description(self) -> str:
        return "Get the current weather at a location"

    @property
    def input_schema(self) -> type[ToolInput]:
        return WeatherToolInput

    async def execute(self, tool_input: WeatherToolInput) -> Any:
        return await self._weather_service.get_weather(
            tool_input.latitude,
            tool_input.longitude
        )
```

### Weather Service Adapter (`api/infrastructure/services/openmeteo_adapter.py`)

```python
import httpx
from typing import Dict, Any
from ...domain.ports.weather_service import IWeatherService
from ...domain.exceptions import WeatherServiceError

class OpenMeteoWeatherAdapter(IWeatherService):
    """OpenMeteo implementation of IWeatherService"""

    async def get_weather(self, latitude: float, longitude: float) -> Dict[str, Any]:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={latitude}&longitude={longitude}"
            f"&current=temperature_2m&hourly=temperature_2m"
            f"&daily=sunrise,sunset&timezone=auto"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            raise WeatherServiceError(f"Failed to fetch weather: {str(e)}")
```

### Protocol Adapter (`api/infrastructure/protocol/vercel_stream.py`)

```python
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
```

## Web Layer Design

### Message Mapper (`api/web/mappers/message_mapper.py`)

```python
from typing import List
from ...domain.entities.message import Message, MessageRole, Attachment
from ..dtos.client_messages import ClientMessage, ClientAttachment

class MessageMapper:
    """Maps between web DTOs and domain entities"""

    @staticmethod
    def to_domain(client_message: ClientMessage) -> List[Message]:
        """
        Convert ClientMessage to domain Message(s).

        May return multiple messages if tool invocations are present.
        """
        messages = []

        # Main message
        attachments = []
        if client_message.experimental_attachments:
            for att in client_message.experimental_attachments:
                attachments.append(Attachment(
                    content_type=att.contentType,
                    url=att.url
                ))

        messages.append(Message(
            role=MessageRole(client_message.role),
            content=client_message.content,
            attachments=attachments
        ))

        # Tool response messages
        if client_message.toolInvocations:
            for invocation in client_message.toolInvocations:
                if invocation.state == 'result':
                    messages.append(Message(
                        role=MessageRole.TOOL,
                        content=str(invocation.result),
                        tool_call_id=invocation.toolCallId
                    ))

        return messages

    @staticmethod
    def to_domain_list(client_messages: List[ClientMessage]) -> List[Message]:
        """Convert list of ClientMessage to flat list of domain Message"""
        domain_messages = []
        for client_msg in client_messages:
            domain_messages.extend(MessageMapper.to_domain(client_msg))
        return domain_messages
```

### FastAPI Router (`api/web/routers/chat.py`)

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, AsyncIterator
from dependency_injector.wiring import inject, Provide

from ...application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from ...infrastructure.protocol.vercel_stream import VercelStreamProtocolAdapter
from ...domain.exceptions import (
    DomainException, ToolExecutionError, LLMProviderError, RateLimitError
)
from ..dtos.client_messages import ClientMessage
from ..mappers.message_mapper import MessageMapper
from ...config.container import Container

router = APIRouter()

@router.post("/api/chat")
@inject
async def stream_chat(
    request: ChatRequest,
    use_case: StreamChatCompletionUseCase = Depends(Provide[Container.stream_chat_use_case])
):
    """
    Stream chat completion endpoint.

    Handles:
    1. DTO to domain conversion
    2. Use case execution
    3. Domain events to protocol format conversion
    4. Exception to HTTP status mapping
    """
    try:
        # Convert web DTOs to domain entities
        domain_messages = MessageMapper.to_domain_list(request.messages)

        # Execute use case and convert events to protocol format
        async def event_generator() -> AsyncIterator[str]:
            async for event in use_case.execute(domain_messages):
                protocol_string = VercelStreamProtocolAdapter.format_event(event)
                if protocol_string:  # Skip empty strings
                    yield protocol_string

        # Return streaming response
        response = StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )
        response.headers['x-vercel-ai-data-stream'] = 'v1'
        return response

    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ToolExecutionError as e:
        raise HTTPException(status_code=500, detail=f"Tool execution failed: {str(e)}")
    except LLMProviderError as e:
        raise HTTPException(status_code=502, detail=f"LLM provider error: {str(e)}")
    except DomainException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

class ChatRequest(BaseModel):
    messages: List[ClientMessage]
```

### Client DTOs (`api/web/dtos/client_messages.py`)

```python
from pydantic import BaseModel
from typing import List, Optional, Any
from enum import Enum

class ClientAttachment(BaseModel):
    contentType: str
    url: str

class ToolInvocationState(str, Enum):
    CALL = 'call'
    PARTIAL_CALL = 'partial-call'
    RESULT = 'result'

class ToolInvocation(BaseModel):
    state: ToolInvocationState
    toolCallId: str
    toolName: str
    args: Any
    result: Any = None

class ClientMessage(BaseModel):
    """Frontend message format - matches existing contract"""
    role: str
    content: str
    experimental_attachments: Optional[List[ClientAttachment]] = None
    toolInvocations: Optional[List[ToolInvocation]] = None
```

## Dependency Injection Setup

### Container Configuration (`api/config/container.py`)

```python
from dependency_injector import containers, providers
from ..infrastructure.llm.openai_adapter import OpenAILLMAdapter
from ..infrastructure.services.openmeteo_adapter import OpenMeteoWeatherAdapter
from ..infrastructure.tools.tool_executor import ToolExecutor
from ..infrastructure.tools.weather_tool import WeatherTool
from ..application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from .settings import Settings

class Container(containers.DeclarativeContainer):
    """Dependency injection container"""

    # Configuration
    config = providers.Configuration()

    # Settings
    settings = providers.Singleton(Settings)

    # Infrastructure - External Services
    weather_service = providers.Singleton(OpenMeteoWeatherAdapter)

    # Infrastructure - LLM Provider
    llm_provider = providers.Singleton(
        OpenAILLMAdapter,
        api_key=settings.provided.openai_api_key
    )

    # Infrastructure - Tools
    weather_tool = providers.Singleton(
        WeatherTool,
        weather_service=weather_service
    )

    # Infrastructure - Tool Executor
    tool_executor = providers.Singleton(ToolExecutor)

    # Application - Use Cases
    stream_chat_use_case = providers.Factory(
        StreamChatCompletionUseCase,
        llm_provider=llm_provider,
        tool_executor=tool_executor
    )

    def wire_tools(self):
        """Register all tools with executor"""
        executor = self.tool_executor()
        executor.register_tool(self.weather_tool())
```

### Settings (`api/config/settings.py`)

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    """Application settings"""
    openai_api_key: str
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

### Application Initialization (`api/index.py`)

```python
from fastapi import FastAPI
from .config.container import Container
from .web.routers import chat

# Create container
container = Container()
container.config.from_dict({
    "openai_api_key": container.settings().openai_api_key
})

# Register tools
container.wire_tools()

# Create FastAPI app
app = FastAPI()

# Wire dependencies
container.wire(modules=[chat])

# Include routers
app.include_router(chat.router)

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

## Layer Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        WEB LAYER                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  FastAPI Router (chat.py)                              │ │
│  │  - Receives ClientMessage[] (DTO)                      │ │
│  │  - Maps to domain Message[] via MessageMapper          │ │
│  │  - Calls use case                                      │ │
│  │  - Converts StreamEvent to protocol via                │ │
│  │    VercelStreamProtocolAdapter                         │ │
│  │  - Returns StreamingResponse                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Message[] (domain)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  StreamChatCompletionUseCase                           │ │
│  │  - Receives domain Message[]                           │ │
│  │  - Calls llm_provider.stream_completion()              │ │
│  │  - Receives LLMEvent (port contract)                   │ │
│  │  - Orchestrates tool execution                         │ │
│  │  - Yields StreamEvent (domain events)                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ ILLMProvider port
                             │ IToolExecutor port
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  OpenAILLMAdapter (implements ILLMProvider)            │ │
│  │  - Converts Message[] → OpenAI format                  │ │
│  │  - Calls OpenAI API                                    │ │
│  │  - Converts OpenAI chunks → LLMEvent                   │ │
│  │  - Yields LLMEvent                                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ToolExecutor (implements IToolExecutor)               │ │
│  │  - Validates args with Pydantic                        │ │
│  │  - Calls tool.execute()                                │ │
│  │  - Returns ToolResult                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  WeatherTool (implements ITool)                        │ │
│  │  - Calls weather_service.get_weather()                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ IWeatherService port
                             ▼
                  OpenMeteoWeatherAdapter
                  (implements IWeatherService)
```

## Request/Response Flow

### Complete Flow Example

```
1. HTTP POST /api/chat
   └─> ClientMessage[] in request body

2. FastAPI Router (chat.py)
   └─> MessageMapper.to_domain_list(client_messages)
   └─> domain Message[] created

3. StreamChatCompletionUseCase.execute(messages)
   └─> Get registered tools from tool_executor
   └─> Call llm_provider.stream_completion(messages, tools)

4. OpenAILLMAdapter.stream_completion(messages, tools)
   └─> Convert Message[] → OpenAI ChatCompletionMessageParam[]
   └─> Convert ITool[] → OpenAI tool schemas
   └─> Call openai.chat.completions.create(stream=True)
   └─> For each OpenAI chunk:
       ├─> choice.delta.content → yield LLMTextDelta(content)
       ├─> choice.delta.tool_calls → yield LLMToolCallDelta(...)
       └─> chunk.usage → yield LLMFinished(...)

5. Use Case receives LLMEvent
   └─> LLMTextDelta → yield TextDelta (domain event)
   └─> LLMToolCallDelta → accumulate, yield ToolCallArgumentChunk
   └─> LLMFinished:
       ├─> Parse complete tool calls
       ├─> yield ToolCallCompleted for each
       ├─> Call tool_executor.execute(tool_call)
       ├─> yield ToolResultAvailable(result)
       └─> yield CompletionFinished(usage)

6. Router receives StreamEvent
   └─> VercelStreamProtocolAdapter.format_event(event)
   └─> TextDelta → "0:{content}\n"
   └─> ToolCallCompleted → "9:{...}\n"
   └─> ToolResultAvailable → "a:{...}\n"
   └─> CompletionFinished → "e:{...}\n"

7. FastAPI StreamingResponse
   └─> Yields protocol strings to client
   └─> Header: x-vercel-ai-data-stream: v1
```

## Critical Implementation Notes

### 1. Async Throughout

**IMPORTANT:** All I/O operations must be async:

```python
# ✅ CORRECT
class OpenAILLMAdapter(ILLMProvider):
    async def stream_completion(self, ...) -> AsyncIterator[LLMEvent]:
        stream = await self._client.chat.completions.create(...)  # async
        async for chunk in stream:  # async iteration
            yield event

# ✅ CORRECT
class WeatherService(IWeatherService):
    async def get_weather(self, ...) -> dict:
        async with httpx.AsyncClient() as client:  # async context
            response = await client.get(url)  # async request
            return response.json()

# ❌ WRONG - synchronous requests blocks event loop
class WeatherService(IWeatherService):
    async def get_weather(self, ...) -> dict:
        response = requests.get(url)  # BLOCKS!
        return response.json()
```

### 2. Error Handling Strategy

**Layer-specific error handling:**

```python
# Infrastructure: Catch external errors, convert to domain exceptions
try:
    response = await client.get(url)
except httpx.HTTPError as e:
    raise WeatherServiceError(f"API failed: {str(e)}")

# Application: Let domain exceptions propagate
async def execute(self, messages):
    # Don't catch domain exceptions here
    async for event in self._llm_provider.stream_completion(messages):
        yield event

# Web: Catch domain exceptions, map to HTTP
try:
    async for event in use_case.execute(messages):
        yield format_event(event)
except RateLimitError:
    raise HTTPException(status_code=429)
except ToolExecutionError:
    raise HTTPException(status_code=500)
```

### 3. Dependency Injection Patterns

```python
# ✅ CORRECT - Constructor injection
class StreamChatCompletionUseCase:
    def __init__(self, llm_provider: ILLMProvider, tool_executor: IToolExecutor):
        self._llm_provider = llm_provider
        self._tool_executor = tool_executor

# ✅ CORRECT - Factory provider for use cases (new instance per request)
stream_chat_use_case = providers.Factory(
    StreamChatCompletionUseCase,
    llm_provider=llm_provider,
    tool_executor=tool_executor
)

# ✅ CORRECT - Singleton for services (shared instance)
weather_service = providers.Singleton(OpenMeteoWeatherAdapter)

# ❌ WRONG - Service locator pattern
class StreamChatCompletionUseCase:
    def execute(self):
        provider = container.llm_provider()  # DON'T DO THIS
```

### 4. Pydantic Tool Schema Conversion

```python
# Tool schema is Pydantic model
class WeatherToolInput(ToolInput):
    latitude: float = Field(description="The latitude of the location")
    longitude: float = Field(description="The longitude of the location")

# Convert to OpenAI format
def pydantic_to_openai_tool(tool: ITool) -> dict:
    schema = tool.input_schema.model_json_schema()
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": schema  # Pydantic generates JSON schema
        }
    }

# Validate arguments when executing
tool_input = tool.input_schema(**tool_call.arguments)  # Pydantic validation
result = await tool.execute(tool_input)
```

### 5. Testing Strategy

**Unit test each layer independently:**

```python
# Domain entity tests
def test_message_validation():
    with pytest.raises(ValueError):
        Message(role=MessageRole.USER, content="")  # Empty content

# Use case tests with mocked ports
@pytest.mark.asyncio
async def test_stream_chat_completion():
    # Mock dependencies
    mock_llm = AsyncMock(spec=ILLMProvider)
    mock_llm.stream_completion.return_value = async_iterator([
        LLMTextDelta(content="Hello")
    ])

    use_case = StreamChatCompletionUseCase(mock_llm, mock_tool_executor)

    events = [e async for e in use_case.execute([message])]
    assert isinstance(events[0], TextDelta)

# Infrastructure tests with real adapters (integration tests)
@pytest.mark.asyncio
async def test_openai_adapter_integration():
    adapter = OpenAILLMAdapter(api_key=os.getenv("OPENAI_API_KEY"))
    events = [e async for e in adapter.stream_completion(messages, tools)]
    assert len(events) > 0
```

## Red Flags & Anti-Patterns to Avoid

### ❌ DON'T: Mix Infrastructure in Domain

```python
# WRONG - OpenAI types in domain
from openai.types.chat import ChatCompletionMessageParam

class Message:
    def to_openai(self) -> ChatCompletionMessageParam:  # NO!
        pass
```

### ❌ DON'T: Make Use Cases Know About Protocols

```python
# WRONG - Protocol formatting in use case
async def execute(self, messages):
    async for chunk in self._llm_provider.stream():
        yield f'0:{chunk.content}\n'  # NO! This is protocol-specific
```

### ❌ DON'T: Put Business Logic in Adapters

```python
# WRONG - Business logic in infrastructure
class OpenAILLMAdapter:
    async def stream_completion(self, messages):
        # NO! Don't decide tool execution logic here
        if should_execute_tool(chunk):
            execute_tool()
```

### ❌ DON'T: Use Service Locator Pattern

```python
# WRONG
class UseCase:
    def execute(self):
        provider = ServiceLocator.get('llm_provider')  # NO!

# CORRECT - Constructor injection
class UseCase:
    def __init__(self, provider: ILLMProvider):
        self._provider = provider
```

### ❌ DON'T: Leak DTOs Across Layers

```python
# WRONG - Web DTO in application layer
async def execute(self, client_messages: List[ClientMessage]):  # NO!

# CORRECT - Domain entities in application layer
async def execute(self, messages: List[Message]):  # YES!
```

## File Creation Checklist

### Phase 1: Domain Foundation
- [ ] `api/domain/entities/message.py` - Message, MessageRole, Attachment
- [ ] `api/domain/entities/tool.py` - ToolCall, ToolResult, ITool, ToolInput
- [ ] `api/domain/entities/events.py` - StreamEvent hierarchy
- [ ] `api/domain/ports/llm_provider.py` - ILLMProvider, LLMEvent types
- [ ] `api/domain/ports/tool_executor.py` - IToolExecutor
- [ ] `api/domain/ports/weather_service.py` - IWeatherService
- [ ] `api/domain/exceptions.py` - All domain exceptions

### Phase 2: Application Layer
- [ ] `api/application/use_cases/stream_chat_completion.py` - Main use case
- [ ] `api/application/use_cases/__init__.py`

### Phase 3: Infrastructure Layer
- [ ] `api/infrastructure/llm/openai_adapter.py` - OpenAI implementation
- [ ] `api/infrastructure/tools/tool_executor.py` - Tool executor
- [ ] `api/infrastructure/tools/weather_tool.py` - Weather tool
- [ ] `api/infrastructure/services/openmeteo_adapter.py` - Weather service
- [ ] `api/infrastructure/protocol/vercel_stream.py` - Protocol adapter

### Phase 4: Web Layer
- [ ] `api/web/dtos/client_messages.py` - Frontend DTOs (move from utils/prompt.py)
- [ ] `api/web/mappers/message_mapper.py` - DTO ↔ Domain conversion
- [ ] `api/web/routers/chat.py` - FastAPI router

### Phase 5: Configuration
- [ ] `api/config/settings.py` - Settings management
- [ ] `api/config/container.py` - DI container
- [ ] `api/index.py` - Refactored app initialization
- [ ] `requirements.txt` - Add `dependency-injector==4.41.0`, `httpx`

### Phase 6: Testing
- [ ] `tests/domain/test_message.py`
- [ ] `tests/domain/test_tool.py`
- [ ] `tests/application/test_stream_chat_completion.py`
- [ ] `tests/infrastructure/test_openai_adapter.py`
- [ ] `tests/web/test_chat_router.py`

## Migration Execution Order

### Step 1: Create Domain Layer (No Breaking Changes)
- Create all domain entities, ports, exceptions
- Can coexist with existing code
- Run existing tests to ensure nothing breaks

### Step 2: Create Infrastructure Adapters
- Implement OpenAI adapter
- Implement tool executor
- Implement weather service
- Keep existing code working

### Step 3: Create Application Layer
- Implement use case
- Wire with DI container
- Still using old router

### Step 4: Create Web Layer
- Implement new router in parallel
- Test with existing endpoint
- Keep old endpoint as fallback

### Step 5: Cutover
- Switch old endpoint to new implementation
- Remove old code
- Deploy

### Step 6: Cleanup
- Remove old utils/prompt.py (logic moved to mapper)
- Remove old utils/tools.py (logic moved to infrastructure/tools)
- Update CLAUDE.md documentation

## Summary

This architecture achieves:

✅ **True hexagonal architecture** - domain is pure, infrastructure is pluggable
✅ **Clean separation of concerns** - each layer has single responsibility
✅ **Testability** - mock at port boundaries, test each layer independently
✅ **Maintainability** - changes isolated to appropriate layers
✅ **Scalability** - add new LLM providers or tools without touching core logic
✅ **Type safety** - Pydantic for validation, proper async types throughout

**Key to Success:**
1. Domain layer must NEVER import from infrastructure or web layers
2. Use case yields domain events, not protocol strings
3. Infrastructure adapters convert between external systems and domain
4. Web layer maps between frontend contracts and domain
5. DI container wires everything together at startup

**Most Important Lesson:**
Streaming is an infrastructure concern. The domain represents business events (TextDelta, ToolCallCompleted), and infrastructure layers handle how those events are delivered (OpenAI chunks, Vercel protocol).

Fran, this plan corrects the critical architectural issues and provides a solid foundation for hexagonal architecture. The key changes are:
- Streaming as infrastructure, not domain
- Event-based model instead of protocol-specific chunks
- Tool executor instead of tool repository
- Proper async throughout
- Clean DI with dependency-injector
