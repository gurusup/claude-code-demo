# ABOUTME: Unit tests for domain Tool entities (ToolCall, ToolResult, ITool interface)
# ABOUTME: Tests validation, business rules, and tool interface contract
import pytest
from dataclasses import FrozenInstanceError
from abc import ABC
from pydantic import BaseModel, Field

from api.domain.entities.tool import ToolCall, ToolResult, ITool, ToolInput


class TestToolInput:
    """Tests for ToolInput Pydantic base model"""

    def test_tool_input_is_pydantic_base_model(self):
        """Test that ToolInput inherits from Pydantic BaseModel"""
        assert issubclass(ToolInput, BaseModel)

    def test_can_create_custom_tool_input(self):
        """Test creating a custom tool input schema"""
        # Arrange
        class WeatherInput(ToolInput):
            latitude: float = Field(description="Latitude")
            longitude: float = Field(description="Longitude")

        # Act
        tool_input = WeatherInput(latitude=37.7749, longitude=-122.4194)

        # Assert
        assert tool_input.latitude == 37.7749
        assert tool_input.longitude == -122.4194

    def test_custom_tool_input_validates_types(self):
        """Test that custom tool input validates field types"""
        # Arrange
        class TestInput(ToolInput):
            value: int

        # Act & Assert
        with pytest.raises(Exception):  # Pydantic validation error
            TestInput(value="not_an_int")


class TestToolCall:
    """Tests for ToolCall domain entity"""

    def test_create_tool_call_successfully(self):
        """Test creating a valid tool call"""
        # Arrange & Act
        tool_call = ToolCall(
            id="call_abc123",
            name="get_current_weather",
            arguments={"latitude": 37.7749, "longitude": -122.4194}
        )

        # Assert
        assert tool_call.id == "call_abc123"
        assert tool_call.name == "get_current_weather"
        assert tool_call.arguments["latitude"] == 37.7749
        assert tool_call.arguments["longitude"] == -122.4194

    def test_tool_call_with_empty_id_raises_error(self):
        """Test that empty id raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="ToolCall id cannot be empty"):
            ToolCall(id="", name="test_tool", arguments={})

    def test_tool_call_with_empty_name_raises_error(self):
        """Test that empty name raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="ToolCall name cannot be empty"):
            ToolCall(id="call_123", name="", arguments={})

    def test_tool_call_is_immutable(self):
        """Test that ToolCall is immutable (frozen dataclass)"""
        # Arrange
        tool_call = ToolCall(id="call_123", name="test_tool", arguments={})

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            tool_call.name = "modified_tool"

    def test_tool_call_with_empty_arguments(self):
        """Test tool call with empty arguments dictionary"""
        # Arrange & Act
        tool_call = ToolCall(id="call_123", name="test_tool", arguments={})

        # Assert
        assert tool_call.arguments == {}

    def test_tool_call_with_complex_arguments(self):
        """Test tool call with complex nested arguments"""
        # Arrange
        complex_args = {
            "location": {
                "city": "San Francisco",
                "coordinates": {
                    "lat": 37.7749,
                    "lon": -122.4194
                }
            },
            "units": "celsius",
            "include_forecast": True
        }

        # Act
        tool_call = ToolCall(id="call_123", name="weather", arguments=complex_args)

        # Assert
        assert tool_call.arguments["location"]["city"] == "San Francisco"
        assert tool_call.arguments["location"]["coordinates"]["lat"] == 37.7749
        assert tool_call.arguments["units"] == "celsius"
        assert tool_call.arguments["include_forecast"] is True

    @pytest.mark.parametrize("tool_id,tool_name,args", [
        ("call_1", "tool_1", {}),
        ("call_abc123xyz", "get_weather", {"lat": 0, "lon": 0}),
        ("call_special-chars_123", "tool_name_with_underscores", {"key": "value"}),
    ])
    def test_tool_call_with_various_valid_inputs(self, tool_id, tool_name, args):
        """Parametrized test for tool call with various valid inputs"""
        tool_call = ToolCall(id=tool_id, name=tool_name, arguments=args)
        assert tool_call.id == tool_id
        assert tool_call.name == tool_name
        assert tool_call.arguments == args

    def test_tool_call_equality(self):
        """Test that tool calls with same values are equal"""
        # Arrange
        tool_call1 = ToolCall(id="call_123", name="test", arguments={"a": 1})
        tool_call2 = ToolCall(id="call_123", name="test", arguments={"a": 1})

        # Act & Assert
        assert tool_call1 == tool_call2

    def test_tool_call_inequality(self):
        """Test that tool calls with different values are not equal"""
        # Arrange
        tool_call1 = ToolCall(id="call_123", name="test", arguments={"a": 1})
        tool_call2 = ToolCall(id="call_456", name="test", arguments={"a": 1})

        # Act & Assert
        assert tool_call1 != tool_call2


class TestToolResult:
    """Tests for ToolResult domain entity"""

    def test_create_tool_result_successfully(self):
        """Test creating a valid tool result"""
        # Arrange & Act
        tool_result = ToolResult(
            call_id="call_abc123",
            name="get_current_weather",
            result={"temperature": 72, "conditions": "sunny"}
        )

        # Assert
        assert tool_result.call_id == "call_abc123"
        assert tool_result.name == "get_current_weather"
        assert tool_result.result["temperature"] == 72
        assert tool_result.result["conditions"] == "sunny"

    def test_tool_result_with_empty_call_id_raises_error(self):
        """Test that empty call_id raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="ToolResult call_id cannot be empty"):
            ToolResult(call_id="", name="test_tool", result={})

    def test_tool_result_is_immutable(self):
        """Test that ToolResult is immutable (frozen dataclass)"""
        # Arrange
        tool_result = ToolResult(call_id="call_123", name="test", result={})

        # Act & Assert
        with pytest.raises(FrozenInstanceError):
            tool_result.name = "modified"

    def test_tool_result_with_string_result(self):
        """Test tool result with string result"""
        # Arrange & Act
        tool_result = ToolResult(
            call_id="call_123",
            name="test_tool",
            result="Simple string result"
        )

        # Assert
        assert tool_result.result == "Simple string result"

    def test_tool_result_with_list_result(self):
        """Test tool result with list result"""
        # Arrange & Act
        tool_result = ToolResult(
            call_id="call_123",
            name="search",
            result=["item1", "item2", "item3"]
        )

        # Assert
        assert len(tool_result.result) == 3
        assert tool_result.result[0] == "item1"

    def test_tool_result_with_none_result(self):
        """Test tool result with None result"""
        # Arrange & Act
        tool_result = ToolResult(
            call_id="call_123",
            name="test_tool",
            result=None
        )

        # Assert
        assert tool_result.result is None

    def test_tool_result_with_numeric_result(self):
        """Test tool result with numeric result"""
        # Arrange & Act
        tool_result = ToolResult(
            call_id="call_123",
            name="calculate",
            result=42.5
        )

        # Assert
        assert tool_result.result == 42.5

    def test_tool_result_with_boolean_result(self):
        """Test tool result with boolean result"""
        # Arrange & Act
        tool_result = ToolResult(
            call_id="call_123",
            name="check",
            result=True
        )

        # Assert
        assert tool_result.result is True

    @pytest.mark.parametrize("call_id,name,result", [
        ("call_1", "tool_1", {}),
        ("call_123", "weather", {"temp": 72}),
        ("call_abc", "search", ["a", "b", "c"]),
        ("call_xyz", "calculate", 42),
        ("call_test", "check", True),
    ])
    def test_tool_result_with_various_valid_inputs(self, call_id, name, result):
        """Parametrized test for tool result with various valid inputs"""
        tool_result = ToolResult(call_id=call_id, name=name, result=result)
        assert tool_result.call_id == call_id
        assert tool_result.name == name
        assert tool_result.result == result

    def test_tool_result_equality(self):
        """Test that tool results with same values are equal"""
        # Arrange
        result1 = ToolResult(call_id="call_123", name="test", result={"a": 1})
        result2 = ToolResult(call_id="call_123", name="test", result={"a": 1})

        # Act & Assert
        assert result1 == result2


class TestITool:
    """Tests for ITool interface"""

    def test_itool_is_abstract_base_class(self):
        """Test that ITool is an abstract base class"""
        assert issubclass(ITool, ABC)

    def test_cannot_instantiate_itool_directly(self):
        """Test that ITool cannot be instantiated directly"""
        # Act & Assert
        with pytest.raises(TypeError):
            ITool()

    def test_concrete_tool_implementation(self):
        """Test creating a concrete tool implementation"""
        # Arrange
        class TestToolInput(ToolInput):
            value: int

        class TestTool(ITool):
            @property
            def name(self) -> str:
                return "test_tool"

            @property
            def description(self) -> str:
                return "A test tool"

            @property
            def input_schema(self) -> type[ToolInput]:
                return TestToolInput

            async def execute(self, tool_input: ToolInput):
                return {"result": tool_input.value * 2}

        # Act
        tool = TestTool()

        # Assert
        assert tool.name == "test_tool"
        assert tool.description == "A test tool"
        assert tool.input_schema == TestToolInput

    def test_concrete_tool_must_implement_all_methods(self):
        """Test that concrete tool must implement all abstract methods"""
        # Arrange & Act & Assert
        with pytest.raises(TypeError):
            class IncompleteTool(ITool):
                @property
                def name(self) -> str:
                    return "incomplete"
                # Missing other methods

            IncompleteTool()

    @pytest.mark.asyncio
    async def test_concrete_tool_execute_is_async(self):
        """Test that tool execute method is async"""
        # Arrange
        class TestToolInput(ToolInput):
            value: int

        class AsyncTool(ITool):
            @property
            def name(self) -> str:
                return "async_tool"

            @property
            def description(self) -> str:
                return "An async tool"

            @property
            def input_schema(self) -> type[ToolInput]:
                return TestToolInput

            async def execute(self, tool_input: ToolInput):
                return {"doubled": tool_input.value * 2}

        # Act
        tool = AsyncTool()
        input_data = TestToolInput(value=21)
        result = await tool.execute(input_data)

        # Assert
        assert result["doubled"] == 42
