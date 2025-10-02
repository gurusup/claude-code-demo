# ABOUTME: Unit tests for chat router
# ABOUTME: Tests HTTP endpoints, streaming, dependency injection, and error handling
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import AsyncMock, MagicMock, patch

from api.web.routers.chat import router, ChatRequest
from api.application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from api.domain.entities.events import TextDelta, CompletionFinished, UsageStats
from api.domain.exceptions import LLMProviderError, RateLimitError, ToolExecutionError


class TestChatRouter:
    """Tests for /api/chat endpoint"""

    @pytest.fixture
    def app(self):
        """Create FastAPI app with chat router"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_use_case(self):
        """Create mock StreamChatCompletionUseCase"""
        return AsyncMock(spec=StreamChatCompletionUseCase)

    @pytest.fixture
    def client(self, app, mock_use_case):
        """Create test client with mocked dependencies"""
        # Override dependency
        async def override_use_case():
            return mock_use_case

        # Note: You'll need to implement the actual dependency override in the router
        # For now, we'll patch it
        with patch('api.web.routers.chat.StreamChatCompletionUseCase', return_value=mock_use_case):
            with TestClient(app) as client:
                yield client, mock_use_case

    def test_post_chat_returns_streaming_response(self, client):
        """Test that POST /api/chat returns streaming response"""
        # Arrange
        test_client, mock_use_case = client

        async def mock_stream(*args, **kwargs):
            yield TextDelta(content="Hello")
            yield CompletionFinished(
                finish_reason="stop",
                usage=UsageStats(prompt_tokens=10, completion_tokens=5, total_tokens=15)
            )

        mock_use_case.execute.return_value = mock_stream()

        request_payload = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }

        # Act
        response = test_client.post("/api/chat", json=request_payload)

        # Assert
        assert response.status_code == 200
        assert "x-vercel-ai-data-stream" in response.headers
        assert response.headers["x-vercel-ai-data-stream"] == "v1"

    def test_post_chat_with_invalid_payload_returns_422(self, client):
        """Test validation error for invalid request payload"""
        # Arrange
        test_client, _ = client
        invalid_payload = {
            "messages": "not a list"  # Should be array
        }

        # Act
        response = test_client.post("/api/chat", json=invalid_payload)

        # Assert
        assert response.status_code == 422

    def test_post_chat_with_missing_messages_returns_422(self, client):
        """Test validation error for missing messages field"""
        # Arrange
        test_client, _ = client
        invalid_payload = {}  # Missing messages

        # Act
        response = test_client.post("/api/chat", json=invalid_payload)

        # Assert
        assert response.status_code == 422

    def test_post_chat_handles_rate_limit_error(self, client):
        """Test handling of rate limit errors"""
        # Arrange
        test_client, mock_use_case = client

        async def mock_stream_with_error(*args, **kwargs):
            if False:
                yield
            raise RateLimitError("Rate limit exceeded")

        mock_use_case.execute.return_value = mock_stream_with_error()

        request_payload = {
            "messages": [{"role": "user", "content": "Test"}]
        }

        # Act
        response = test_client.post("/api/chat", json=request_payload)

        # Assert
        assert response.status_code == 429

    def test_post_chat_handles_tool_execution_error(self, client):
        """Test handling of tool execution errors"""
        # Arrange
        test_client, mock_use_case = client

        async def mock_stream_with_error(*args, **kwargs):
            if False:
                yield
            raise ToolExecutionError("test_tool", Exception("Tool failed"))

        mock_use_case.execute.return_value = mock_stream_with_error()

        request_payload = {
            "messages": [{"role": "user", "content": "Test"}]
        }

        # Act
        response = test_client.post("/api/chat", json=request_payload)

        # Assert
        assert response.status_code == 500

    def test_post_chat_handles_llm_provider_error(self, client):
        """Test handling of LLM provider errors"""
        # Arrange
        test_client, mock_use_case = client

        async def mock_stream_with_error(*args, **kwargs):
            if False:
                yield
            raise LLMProviderError("OpenAI API error")

        mock_use_case.execute.return_value = mock_stream_with_error()

        request_payload = {
            "messages": [{"role": "user", "content": "Test"}]
        }

        # Act
        response = test_client.post("/api/chat", json=request_payload)

        # Assert
        assert response.status_code == 502

    def test_chat_request_validates_messages(self):
        """Test ChatRequest model validates messages field"""
        # Arrange & Act
        request = ChatRequest(messages=[])

        # Assert
        assert request.messages == []

    def test_chat_request_with_valid_messages(self):
        """Test ChatRequest with valid messages"""
        # Arrange
        from api.web.dtos.client_messages import ClientMessage

        messages = [
            ClientMessage(role="user", content="Hello", experimental_attachments=None, toolInvocations=None)
        ]

        # Act
        request = ChatRequest(messages=messages)

        # Assert
        assert len(request.messages) == 1
        assert request.messages[0].role == "user"
