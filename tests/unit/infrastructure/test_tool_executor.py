# ABOUTME: Unit tests for ToolExecutor implementation
# ABOUTME: Tests tool registration, execution, argument validation, and error handling
import pytest
from unittest.mock import AsyncMock, MagicMock
from pydantic import Field

from api.infrastructure.tools.tool_executor import ToolExecutor
from api.domain.entities.tool import ToolCall, ToolResult, ITool, ToolInput
from api.domain.exceptions import ToolNotFoundError, ToolExecutionError


class TestToolExecutor:
    """Tests for ToolExecutor"""

    @pytest.fixture
    def executor(self):
        """Create tool executor instance"""
        return ToolExecutor()

    @pytest.fixture
    def mock_tool(self):
        """Create mock tool"""
        class TestToolInput(ToolInput):
            value: int = Field(description="Test value")

        class MockTool(ITool):
            @property
            def name(self) -> str:
                return "mock_tool"

            @property
            def description(self) -> str:
                return "A mock tool"

            @property
            def input_schema(self) -> type[ToolInput]:
                return TestToolInput

            async def execute(self, tool_input: ToolInput):
                return {"result": tool_input.value * 2}

        return MockTool()

    def test_register_tool(self, executor, mock_tool):
        """Test registering a tool"""
        # Act
        executor.register_tool(mock_tool)

        # Assert
        tools = executor.get_registered_tools()
        assert len(tools) == 1
        assert tools[0].name == "mock_tool"

    def test_register_multiple_tools(self, executor):
        """Test registering multiple tools"""
        # Arrange
        tools_to_register = []
        for i in range(3):
            tool = MagicMock(spec=ITool)
            tool.name = f"tool_{i}"
            tools_to_register.append(tool)

        # Act
        for tool in tools_to_register:
            executor.register_tool(tool)

        # Assert
        registered = executor.get_registered_tools()
        assert len(registered) == 3

    @pytest.mark.asyncio
    async def test_execute_tool_successfully(self, executor, mock_tool):
        """Test successful tool execution"""
        # Arrange
        executor.register_tool(mock_tool)
        tool_call = ToolCall(
            id="call_123",
            name="mock_tool",
            arguments={"value": 21}
        )

        # Act
        result = await executor.execute(tool_call)

        # Assert
        assert isinstance(result, ToolResult)
        assert result.call_id == "call_123"
        assert result.name == "mock_tool"
        assert result.result["result"] == 42

    @pytest.mark.asyncio
    async def test_execute_nonexistent_tool_raises_error(self, executor):
        """Test executing tool that doesn't exist raises ToolNotFoundError"""
        # Arrange
        tool_call = ToolCall(
            id="call_123",
            name="nonexistent_tool",
            arguments={}
        )

        # Act & Assert
        with pytest.raises(ToolNotFoundError, match="nonexistent_tool"):
            await executor.execute(tool_call)

    @pytest.mark.asyncio
    async def test_execute_with_invalid_arguments_raises_error(self, executor, mock_tool):
        """Test executing tool with invalid arguments raises ToolExecutionError"""
        # Arrange
        executor.register_tool(mock_tool)
        tool_call = ToolCall(
            id="call_123",
            name="mock_tool",
            arguments={"value": "not_an_int"}  # Invalid type
        )

        # Act & Assert
        with pytest.raises(ToolExecutionError):
            await executor.execute(tool_call)

    @pytest.mark.asyncio
    async def test_execute_when_tool_raises_exception(self, executor):
        """Test handling when tool execution raises exception"""
        # Arrange
        class FailingToolInput(ToolInput):
            value: int

        class FailingTool(ITool):
            @property
            def name(self) -> str:
                return "failing_tool"

            @property
            def description(self) -> str:
                return "A failing tool"

            @property
            def input_schema(self) -> type[ToolInput]:
                return FailingToolInput

            async def execute(self, tool_input: ToolInput):
                raise ValueError("Tool failed")

        executor.register_tool(FailingTool())
        tool_call = ToolCall(id="call_123", name="failing_tool", arguments={"value": 1})

        # Act & Assert
        with pytest.raises(ToolExecutionError) as exc_info:
            await executor.execute(tool_call)

        assert exc_info.value.tool_name == "failing_tool"
        assert isinstance(exc_info.value.original_error, ValueError)

    def test_get_registered_tools_returns_empty_list_initially(self, executor):
        """Test that newly created executor has no tools"""
        # Act
        tools = executor.get_registered_tools()

        # Assert
        assert tools == []

    def test_register_tool_replaces_existing_with_same_name(self, executor):
        """Test that registering tool with same name replaces the old one"""
        # Arrange
        tool1 = MagicMock(spec=ITool)
        tool1.name = "test_tool"
        tool2 = MagicMock(spec=ITool)
        tool2.name = "test_tool"

        # Act
        executor.register_tool(tool1)
        executor.register_tool(tool2)

        # Assert
        tools = executor.get_registered_tools()
        assert len(tools) == 1
        assert tools[0] == tool2
