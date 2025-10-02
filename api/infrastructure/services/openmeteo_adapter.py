# ABOUTME: OpenMeteo adapter implementing IWeatherService for weather data fetching
# ABOUTME: Uses httpx to call OpenMeteo API and converts responses to domain format
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
