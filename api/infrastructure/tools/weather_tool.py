# ABOUTME: Weather tool implementing ITool for getting current weather by coordinates
# ABOUTME: Uses Pydantic schema for input validation and delegates to IWeatherService
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
