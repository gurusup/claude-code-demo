# ABOUTME: Unit tests for OpenMeteo weather service adapter
# ABOUTME: Tests HTTP calls, response parsing, and error handling with mocked httpx
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from api.infrastructure.services.openmeteo_adapter import OpenMeteoWeatherAdapter
from api.domain.exceptions import WeatherServiceError


class TestOpenMeteoWeatherAdapter:
    """Tests for OpenMeteo weather adapter"""

    @pytest.fixture
    def adapter(self):
        """Create weather adapter instance"""
        return OpenMeteoWeatherAdapter()

    @pytest.mark.asyncio
    async def test_get_weather_success(self, adapter):
        """Test successful weather data retrieval"""
        # Arrange
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "current": {"temperature_2m": 22.5},
            "hourly": {"temperature_2m": [20, 21, 22]},
            "daily": {"sunrise": ["06:30"], "sunset": ["19:45"]}
        }

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            # Act
            result = await adapter.get_weather(latitude=51.5074, longitude=-0.1278)

            # Assert
            assert result["current"]["temperature_2m"] == 22.5
            mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_weather_handles_http_error(self, adapter):
        """Test handling of HTTP errors"""
        # Arrange
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.get.side_effect = httpx.HTTPError("Connection timeout")
            mock_client_class.return_value = mock_client

            # Act & Assert
            with pytest.raises(WeatherServiceError):
                await adapter.get_weather(latitude=0.0, longitude=0.0)

    @pytest.mark.asyncio
    async def test_get_weather_constructs_correct_url(self, adapter):
        """Test that correct URL is constructed with parameters"""
        # Arrange
        mock_response = MagicMock()
        mock_response.json.return_value = {"current": {}, "hourly": {}, "daily": {}}

        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            # Act
            await adapter.get_weather(latitude=37.7749, longitude=-122.4194)

            # Assert
            call_args = mock_client.get.call_args
            url = call_args[0][0]
            assert "latitude=37.7749" in url
            assert "longitude=-122.4194" in url
            assert "current=temperature_2m" in url
