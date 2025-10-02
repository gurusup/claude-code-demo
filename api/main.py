# ABOUTME: Main FastAPI application entry point with hexagonal architecture
# ABOUTME: Wires up dependencies and configures routes for the chat API
from fastapi import FastAPI
from dotenv import load_dotenv

from .config.settings import get_settings
from .domain.ports.llm_provider import ILLMProvider
from .domain.ports.tool_executor import IToolExecutor
from .domain.ports.weather_service import IWeatherService
from .infrastructure.llm.openai_adapter import OpenAILLMAdapter
from .infrastructure.tools.tool_executor import ToolExecutor
from .infrastructure.tools.weather_tool import WeatherTool
from .infrastructure.services.openmeteo_adapter import OpenMeteoWeatherAdapter
from .application.use_cases.stream_chat_completion import StreamChatCompletionUseCase
from .web.routers.chat import create_chat_handler, router

load_dotenv(".env")

# Initialize FastAPI app
app = FastAPI()

# Load settings
settings = get_settings()

# Initialize infrastructure adapters
llm_provider: ILLMProvider = OpenAILLMAdapter(api_key=settings.openai_api_key)
weather_service: IWeatherService = OpenMeteoWeatherAdapter()
tool_executor: IToolExecutor = ToolExecutor()

# Register tools
weather_tool = WeatherTool(weather_service=weather_service)
tool_executor.register_tool(weather_tool)

# Initialize use case
use_case = StreamChatCompletionUseCase(
    llm_provider=llm_provider,
    tool_executor=tool_executor
)

# Create and register chat handler
chat_handler = create_chat_handler(use_case)

# Include router
app.include_router(router)
