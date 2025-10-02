# ABOUTME: Tool executor port defining the contract for tool management and execution
# ABOUTME: Provides interface for registering tools and executing tool calls
from abc import ABC, abstractmethod
from typing import List
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
