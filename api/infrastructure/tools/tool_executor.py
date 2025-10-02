# ABOUTME: Tool executor implementing IToolExecutor for managing and executing tools
# ABOUTME: Maintains tool registry and validates tool inputs using Pydantic schemas
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
