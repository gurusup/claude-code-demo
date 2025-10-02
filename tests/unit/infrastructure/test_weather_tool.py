# ABOUTME: Unit tests for WeatherTool implementation
# ABOUTME: Tests weather tool with mocked weather service
import pytest
from unittest.mock import AsyncMock

from api.infrastructure.tools.weather_tool import WeatherTool, WeatherToolInput
from api.domain.entities.tool import ITool, ToolInput
from api.domain.ports.weather_service import IWeatherService


class TestWeatherToolInput:
    """Tests for WeatherToolInput Pydantic schema"""

    def test_create_weather_tool_input_successfully(self):
        """Test creating valid weather tool input"""
        # Arrange & Act
        tool_input = WeatherToolInput(latitude=37.7749, longitude=-122.4194)

        # Assert
        assert tool_input.latitude == 37.7749
        assert tool_input.longitude == -122.4194

    def test_weather_tool_input_validates_types(self):
        """Test that weather tool input validates field types"""
        # Act & Assert
        with pytest.raises(Exception):  # Pydantic validation error
            WeatherToolInput(latitude="not_a_float", longitude=-122.4194)


class TestWeatherTool:
    """Tests for WeatherTool"""

    @pytest.fixture
    def mock_weather_service(self):
        """Create mock weather service"""
        mock = AsyncMock(spec=IWeatherService)
        mock.get_weather.return_value = {
            "current": {"temperature_2m": 72},
            "hourly": {"temperature_2m": [70, 71, 72]},
            "daily": {"sunrise": ["06:30"], "sunset": ["19:45"]}
        }
        return mock

    @pytest.fixture
    def weather_tool(self, mock_weather_service):
        """Create weather tool with mocked service"""
        return WeatherTool(weather_service=mock_weather_service)

    def test_weather_tool_implements_itool(self, weather_tool):
        """Test that WeatherTool implements ITool interface"""
        assert isinstance(weather_tool, ITool)

    def test_weather_tool_name(self, weather_tool):
        """Test weather tool name property"""
        assert weather_tool.name == "get_current_weather"

    def test_weather_tool_description(self, weather_tool):
        """Test weather tool description property"""
        assert weather_tool.description == "Get the current weather at a location"

    def test_weather_tool_input_schema(self, weather_tool):
        """Test weather tool input schema property"""
        assert weather_tool.input_schema == WeatherToolInput

    @pytest.mark.asyncio
    async def test_execute_calls_weather_service(self, weather_tool, mock_weather_service):
        """Test that execute calls weather service with correct parameters"""
        # Arrange
        tool_input = WeatherToolInput(latitude=37.7749, longitude=-122.4194)

        # Act
        result = await weather_tool.execute(tool_input)

        # Assert
        mock_weather_service.get_weather.assert_called_once_with(37.7749, -122.4194)
        assert result["current"]["temperature_2m"] == 72

    @pytest.mark.asyncio
    async def test_execute_returns_weather_data(self, weather_tool):
        """Test that execute returns weather data"""
        # Arrange
        tool_input = WeatherToolInput(latitude=40.7128, longitude=-74.0060)

        # Act
        result = await weather_tool.execute(tool_input)

        # Assert
        assert "current" in result
        assert "hourly" in result
        assert "daily" in result
