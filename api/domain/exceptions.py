# ABOUTME: Domain exceptions representing business logic errors
# ABOUTME: All domain exceptions inherit from DomainException for clear error boundary
class DomainException(Exception):
    """Base exception for domain layer"""
    pass


class InvalidMessageError(DomainException):
    """Invalid message entity"""
    pass


class LLMProviderError(DomainException):
    """LLM provider error"""
    pass


class RateLimitError(LLMProviderError):
    """LLM provider rate limit exceeded"""
    pass


class ToolNotFoundError(DomainException):
    """Tool not found in registry"""
    pass


class ToolExecutionError(DomainException):
    """Tool execution failed"""
    def __init__(self, tool_name: str, original_error: Exception):
        self.tool_name = tool_name
        self.original_error = original_error
        super().__init__(f"Tool '{tool_name}' failed: {str(original_error)}")


class WeatherServiceError(DomainException):
    """Weather service error"""
    pass
