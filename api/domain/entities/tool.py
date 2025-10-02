# ABOUTME: Tool entities representing tool calls, results, and the tool interface
# ABOUTME: Defines ITool interface and domain objects for tool execution with Pydantic validation
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pydantic import BaseModel
from typing import Any, Dict


class ToolInput(BaseModel):
    """Base class for all tool inputs - uses Pydantic for validation"""
    pass


@dataclass(frozen=True)
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


@dataclass(frozen=True)
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
