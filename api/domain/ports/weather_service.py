# ABOUTME: Weather service port defining the contract for weather data providers
# ABOUTME: Abstract interface for fetching weather information by coordinates
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
