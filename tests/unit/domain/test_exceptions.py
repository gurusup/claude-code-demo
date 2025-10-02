# ABOUTME: Unit tests for domain exceptions
# ABOUTME: Tests exception hierarchy, error messages, and error context preservation
import pytest

from api.domain.exceptions import (
    DomainException, InvalidMessageError, LLMProviderError,
    RateLimitError, ToolNotFoundError, ToolExecutionError,
    WeatherServiceError
)


class TestDomainException:
    """Tests for DomainException base class"""

    def test_domain_exception_is_exception(self):
        """Test that DomainException inherits from Exception"""
        assert issubclass(DomainException, Exception)

    def test_can_raise_domain_exception(self):
        """Test that DomainException can be raised"""
        with pytest.raises(DomainException):
            raise DomainException("Test error")

    def test_domain_exception_with_message(self):
        """Test that DomainException stores error message"""
        try:
            raise DomainException("Test error message")
        except DomainException as e:
            assert str(e) == "Test error message"

    def test_can_catch_domain_exception_base_class(self):
        """Test that subclasses can be caught as DomainException"""
        with pytest.raises(DomainException):
            raise InvalidMessageError("Invalid message")


class TestInvalidMessageError:
    """Tests for InvalidMessageError"""

    def test_invalid_message_error_inherits_from_domain_exception(self):
        """Test that InvalidMessageError inherits from DomainException"""
        assert issubclass(InvalidMessageError, DomainException)

    def test_can_raise_invalid_message_error(self):
        """Test that InvalidMessageError can be raised"""
        with pytest.raises(InvalidMessageError):
            raise InvalidMessageError("Invalid message content")

    def test_invalid_message_error_with_message(self):
        """Test that InvalidMessageError stores error message"""
        try:
            raise InvalidMessageError("Message validation failed")
        except InvalidMessageError as e:
            assert str(e) == "Message validation failed"

    def test_can_catch_as_domain_exception(self):
        """Test that InvalidMessageError can be caught as DomainException"""
        with pytest.raises(DomainException):
            raise InvalidMessageError("Test")


class TestLLMProviderError:
    """Tests for LLMProviderError"""

    def test_llm_provider_error_inherits_from_domain_exception(self):
        """Test that LLMProviderError inherits from DomainException"""
        assert issubclass(LLMProviderError, DomainException)

    def test_can_raise_llm_provider_error(self):
        """Test that LLMProviderError can be raised"""
        with pytest.raises(LLMProviderError):
            raise LLMProviderError("OpenAI API error")

    def test_llm_provider_error_with_message(self):
        """Test that LLMProviderError stores error message"""
        try:
            raise LLMProviderError("API connection failed")
        except LLMProviderError as e:
            assert str(e) == "API connection failed"


class TestRateLimitError:
    """Tests for RateLimitError"""

    def test_rate_limit_error_inherits_from_llm_provider_error(self):
        """Test that RateLimitError inherits from LLMProviderError"""
        assert issubclass(RateLimitError, LLMProviderError)

    def test_rate_limit_error_inherits_from_domain_exception(self):
        """Test that RateLimitError inherits from DomainException"""
        assert issubclass(RateLimitError, DomainException)

    def test_can_raise_rate_limit_error(self):
        """Test that RateLimitError can be raised"""
        with pytest.raises(RateLimitError):
            raise RateLimitError("Rate limit exceeded")

    def test_rate_limit_error_with_message(self):
        """Test that RateLimitError stores error message"""
        try:
            raise RateLimitError("Rate limit exceeded: 429")
        except RateLimitError as e:
            assert str(e) == "Rate limit exceeded: 429"

    def test_can_catch_rate_limit_as_llm_provider_error(self):
        """Test that RateLimitError can be caught as LLMProviderError"""
        with pytest.raises(LLMProviderError):
            raise RateLimitError("Rate limit")

    def test_can_catch_rate_limit_as_domain_exception(self):
        """Test that RateLimitError can be caught as DomainException"""
        with pytest.raises(DomainException):
            raise RateLimitError("Rate limit")


class TestToolNotFoundError:
    """Tests for ToolNotFoundError"""

    def test_tool_not_found_error_inherits_from_domain_exception(self):
        """Test that ToolNotFoundError inherits from DomainException"""
        assert issubclass(ToolNotFoundError, DomainException)

    def test_can_raise_tool_not_found_error(self):
        """Test that ToolNotFoundError can be raised"""
        with pytest.raises(ToolNotFoundError):
            raise ToolNotFoundError("Tool 'test' not found")

    def test_tool_not_found_error_with_message(self):
        """Test that ToolNotFoundError stores error message"""
        try:
            raise ToolNotFoundError("Tool 'get_weather' not found in registry")
        except ToolNotFoundError as e:
            assert str(e) == "Tool 'get_weather' not found in registry"


class TestToolExecutionError:
    """Tests for ToolExecutionError"""

    def test_tool_execution_error_inherits_from_domain_exception(self):
        """Test that ToolExecutionError inherits from DomainException"""
        assert issubclass(ToolExecutionError, DomainException)

    def test_can_raise_tool_execution_error(self):
        """Test that ToolExecutionError can be raised"""
        original_error = ValueError("Invalid argument")
        with pytest.raises(ToolExecutionError):
            raise ToolExecutionError("test_tool", original_error)

    def test_tool_execution_error_stores_tool_name(self):
        """Test that ToolExecutionError stores tool name"""
        original_error = ValueError("Invalid argument")
        try:
            raise ToolExecutionError("get_weather", original_error)
        except ToolExecutionError as e:
            assert e.tool_name == "get_weather"

    def test_tool_execution_error_stores_original_error(self):
        """Test that ToolExecutionError stores original error"""
        original_error = ValueError("Invalid argument")
        try:
            raise ToolExecutionError("test_tool", original_error)
        except ToolExecutionError as e:
            assert e.original_error == original_error
            assert isinstance(e.original_error, ValueError)

    def test_tool_execution_error_message_format(self):
        """Test that ToolExecutionError formats message correctly"""
        original_error = ValueError("Invalid latitude value")
        try:
            raise ToolExecutionError("get_weather", original_error)
        except ToolExecutionError as e:
            assert "get_weather" in str(e)
            assert "Invalid latitude value" in str(e)
            assert str(e) == "Tool 'get_weather' failed: Invalid latitude value"

    def test_tool_execution_error_with_different_exception_types(self):
        """Test ToolExecutionError with various exception types"""
        exceptions = [
            ValueError("Bad value"),
            TypeError("Wrong type"),
            RuntimeError("Runtime error"),
            Exception("Generic error"),
        ]

        for original_error in exceptions:
            try:
                raise ToolExecutionError("test_tool", original_error)
            except ToolExecutionError as e:
                assert e.original_error == original_error
                assert str(original_error) in str(e)

    def test_tool_execution_error_preserves_traceback(self):
        """Test that ToolExecutionError preserves original error traceback"""
        try:
            try:
                1 / 0
            except ZeroDivisionError as original:
                raise ToolExecutionError("calculator", original)
        except ToolExecutionError as e:
            assert isinstance(e.original_error, ZeroDivisionError)
            assert "division" in str(e.original_error).lower() or "zero" in str(e.original_error).lower()


class TestWeatherServiceError:
    """Tests for WeatherServiceError"""

    def test_weather_service_error_inherits_from_domain_exception(self):
        """Test that WeatherServiceError inherits from DomainException"""
        assert issubclass(WeatherServiceError, DomainException)

    def test_can_raise_weather_service_error(self):
        """Test that WeatherServiceError can be raised"""
        with pytest.raises(WeatherServiceError):
            raise WeatherServiceError("Weather API unavailable")

    def test_weather_service_error_with_message(self):
        """Test that WeatherServiceError stores error message"""
        try:
            raise WeatherServiceError("Failed to fetch weather data")
        except WeatherServiceError as e:
            assert str(e) == "Failed to fetch weather data"


class TestExceptionHierarchy:
    """Tests for exception hierarchy and catching behavior"""

    def test_all_exceptions_inherit_from_domain_exception(self):
        """Test that all domain exceptions inherit from DomainException"""
        exceptions = [
            InvalidMessageError,
            LLMProviderError,
            RateLimitError,
            ToolNotFoundError,
            ToolExecutionError,
            WeatherServiceError,
        ]

        for exc_class in exceptions:
            assert issubclass(exc_class, DomainException)

    def test_can_catch_all_domain_exceptions_generically(self):
        """Test that all domain exceptions can be caught as DomainException"""
        exceptions_to_test = [
            InvalidMessageError("test"),
            LLMProviderError("test"),
            RateLimitError("test"),
            ToolNotFoundError("test"),
            ToolExecutionError("tool", Exception("test")),
            WeatherServiceError("test"),
        ]

        for exc in exceptions_to_test:
            with pytest.raises(DomainException):
                raise exc

    def test_specific_exception_catching(self):
        """Test that specific exceptions can be caught individually"""
        # RateLimitError can be caught as RateLimitError
        with pytest.raises(RateLimitError):
            raise RateLimitError("Rate limit")

        # But also as LLMProviderError
        with pytest.raises(LLMProviderError):
            raise RateLimitError("Rate limit")

        # And as DomainException
        with pytest.raises(DomainException):
            raise RateLimitError("Rate limit")

    def test_exception_type_checking(self):
        """Test exception type checking with isinstance"""
        original_error = ValueError("test")
        tool_error = ToolExecutionError("tool", original_error)

        assert isinstance(tool_error, ToolExecutionError)
        assert isinstance(tool_error, DomainException)
        assert isinstance(tool_error, Exception)
        assert not isinstance(tool_error, LLMProviderError)

    def test_rate_limit_error_hierarchy(self):
        """Test RateLimitError hierarchy specifically"""
        error = RateLimitError("Rate limit")

        assert isinstance(error, RateLimitError)
        assert isinstance(error, LLMProviderError)
        assert isinstance(error, DomainException)
        assert isinstance(error, Exception)


class TestExceptionUsage:
    """Tests for exception usage patterns"""

    def test_exception_with_context_manager(self):
        """Test exceptions work correctly with context managers"""
        with pytest.raises(DomainException) as exc_info:
            raise InvalidMessageError("Invalid message")

        assert isinstance(exc_info.value, InvalidMessageError)
        assert str(exc_info.value) == "Invalid message"

    def test_multiple_exception_types_in_try_except(self):
        """Test handling multiple exception types"""
        def raise_various_errors(error_type):
            if error_type == "message":
                raise InvalidMessageError("Invalid")
            elif error_type == "rate_limit":
                raise RateLimitError("Rate limit")
            elif error_type == "tool":
                raise ToolNotFoundError("Not found")

        # Test catching specific types
        try:
            raise_various_errors("message")
        except InvalidMessageError as e:
            assert "Invalid" in str(e)

        try:
            raise_various_errors("rate_limit")
        except RateLimitError as e:
            assert "Rate limit" in str(e)

        try:
            raise_various_errors("tool")
        except ToolNotFoundError as e:
            assert "Not found" in str(e)

    def test_re_raising_exceptions(self):
        """Test re-raising domain exceptions"""
        with pytest.raises(DomainException):
            try:
                raise InvalidMessageError("Original error")
            except InvalidMessageError:
                raise  # Re-raise the same exception
