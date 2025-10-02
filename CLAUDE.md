# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js + FastAPI hybrid application demonstrating AI SDK Python streaming using the Data Stream Protocol. The frontend (Next.js) communicates with a Python backend (FastAPI) for AI chat completions with tool calling capabilities.

## Architecture

### Hybrid Stack
- **Frontend**: Next.js 13 with App Router (`app/` directory)
- **Backend**: FastAPI running on port 8000 (development)
- **API Proxy**: Next.js rewrites route `/api/*` to FastAPI in development (next.config.js:3-27)

### Backend: Hexagonal Architecture (Ports & Adapters)

The FastAPI backend follows clean hexagonal architecture with clear separation of concerns:

**Layers**:
1. **Domain Layer** (`api/domain/`): Core business logic, entities, and port interfaces
   - Entities: Message, ToolCall, StreamEvent (immutable dataclasses)
   - Ports: ILLMProvider, IToolExecutor, IWeatherService (abstract interfaces)
   - Exceptions: Domain-specific error hierarchy

2. **Application Layer** (`api/application/`): Use cases orchestrating business logic
   - `StreamChatCompletionUseCase`: Coordinates LLM streaming and tool execution
   - Converts LLMEvents to domain StreamEvents

3. **Infrastructure Layer** (`api/infrastructure/`): External service adapters
   - `OpenAILLMAdapter`: Implements ILLMProvider for OpenAI API
   - `ToolExecutor`: Manages tool registry and execution with Pydantic validation
   - `WeatherTool`: Example tool implementation
   - `VercelStreamProtocolAdapter`: Converts StreamEvents to Data Stream Protocol v1

4. **Web Layer** (`api/web/`): HTTP concerns (FastAPI routers, DTOs, mappers)
   - `chat.py`: FastAPI router for `/api/chat` endpoint
   - `MessageMapper`: Converts ClientMessage DTOs to domain Messages
   - Maintains backward compatibility with frontend

5. **Configuration** (`api/config/`, `api/main.py`): Dependency wiring
   - Settings management with environment variables
   - Manual dependency injection in main.py

**Key Architectural Benefits**:
- **Testability**: Each layer tested independently with mocked dependencies (213+ unit tests)
- **Flexibility**: Swap LLM providers without changing business logic
- **Maintainability**: Clear boundaries prevent mixing of concerns
- **Event-Based Streaming**: Domain events (TextDelta, ToolCallCompleted) separate from protocol formats

**API Communication Flow**:
1. Frontend sends ClientMessages to `/api/chat`
2. Router converts DTOs to domain Messages via MessageMapper
3. Use case orchestrates LLM streaming and tool execution
4. Domain StreamEvents converted to protocol strings
5. FastAPI streams response with Data Stream Protocol v1 headers

### Directory Structure

```
app/
  (chat)/          # Route group for chat interface
    page.tsx       # Main chat page
  layout.tsx       # Root layout
  globals.css      # Global styles with CSS variables

api/
  main.py          # FastAPI app entry point (hexagonal architecture)
  domain/          # Domain layer (business logic)
    entities/      # Message, Tool, Events
    ports/         # ILLMProvider, IToolExecutor, IWeatherService
    exceptions.py  # Domain exceptions
  application/     # Application layer (use cases)
    use_cases/     # StreamChatCompletionUseCase
  infrastructure/  # Infrastructure layer (adapters)
    llm/           # OpenAILLMAdapter
    tools/         # ToolExecutor, WeatherTool
    services/      # OpenMeteoWeatherAdapter
    protocol/      # VercelStreamProtocolAdapter
  web/             # Web layer (HTTP concerns)
    routers/       # FastAPI routers
    dtos/          # ClientMessage DTOs
    mappers/       # MessageMapper
  config/          # Configuration
    settings.py    # Environment settings

tests/
  unit/            # Unit tests for all layers
    domain/        # Domain entity tests
    application/   # Use case tests
    infrastructure/# Adapter tests
    web/           # Router/mapper tests
  conftest.py      # Shared test fixtures

components/
  chat.tsx         # Main chat component using useChat
  message.tsx      # Individual message rendering
  multimodal-input.tsx  # Chat input with file upload
  ui/              # shadcn/ui components

lib/              # Utility functions
hooks/            # Custom React hooks
```

## Development Commands

### Running the Application

**Development (both frontend + backend concurrently)**:
```bash
yarn dev
```

This runs both:
- Next.js dev server on port 3000
- FastAPI with uvicorn on port 8000 (auto-reload enabled)

**Run services individually**:
```bash
# Frontend only
yarn run next-dev

# Backend only (installs requirements first)
yarn run fastapi-dev
```

### Python Environment Setup

```bash
# Create virtual environment (first time)
virtualenv venv
# or
python -m venv .venv

# Activate (do this each session)
source venv/bin/activate  # macOS/Linux
# or
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Building and Testing

```bash
# Build for production
yarn run build

# Start production server
yarn start

# Lint
yarn run lint
```

### Running Backend Tests

```bash
# Run all unit tests
pytest tests/unit/ -v

# Run with coverage report
pytest tests/unit/ --cov=api --cov-report=html --cov-report=term-missing

# Run specific layer tests
pytest tests/unit/domain/ -v
pytest tests/unit/application/ -v
pytest tests/unit/infrastructure/ -v
pytest tests/unit/web/ -v

# Run tests by marker
pytest -m domain
pytest -m application

# Generate HTML coverage report
pytest tests/unit/ --cov=api --cov-report=html
# View coverage in htmlcov/index.html
```

**Test Suite Stats**:
- 213+ unit tests across all layers
- 99.5% pass rate
- Event-based architecture enables isolated testing with mocked dependencies

## Environment Variables

Required in `.env`:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o model
- (Add other provider keys as needed: Anthropic, etc.)

## Key Technical Details

### Path Aliases (tsconfig.json:22-24)
- `@/*` maps to project root
- Used throughout for clean imports: `@/components/chat`

### shadcn/ui Configuration (components.json)
- Style: "new-york"
- Base color: zinc
- CSS variables enabled for theming
- Components auto-imported to `@/components/ui`

### API Rewrites in Production
In production (Vercel), `/api/*` routes serve from `/api/` directory instead of proxying to port 8000. The FastAPI app must be deployed as a serverless function.

### Streaming Protocol
The backend implements Vercel's Data Stream Protocol v1 (indicated by `x-vercel-ai-data-stream: v1` header). This allows:
- Incremental text streaming
- Tool call streaming with automatic execution
- Usage tracking (prompt/completion tokens)

## Adding New Features

### Adding a New Tool
1. Define function in `api/utils/tools.py`
2. Add to `available_tools` dict in `api/index.py`
3. Add tool schema to OpenAI chat completion calls (lines 36-56, 69-89)

### Adding Frontend Components
Use shadcn/ui CLI:
```bash
npx shadcn-ui@latest add [component-name]
```
Always use yarn instead of npm

### Modifying Message Types
Update `ClientMessage` in `api/utils/prompt.py` and ensure `convert_to_openai_messages()` handles the new format.


## Rules
- After a plan mode phase you should create a `.claude/sessions/context_session_{feature_name}.md` with the definition of the plan
- Before you do any work, MUST view files in `.claude/sessions/context_session_{feature_name}.md` file and `.claude/doc/{feature_name}/*` files to get the full context (feature_name being the id of the session we are operate, if file doesnt exist, then create one)
- `.claude/sessions/context_session_{feature_name}.md` should contain most of context of what we did, overall plan, and sub agents will continusly add context to the file
- After you finish the work, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did
- After you finish the each phase, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did

## Sub agents
You have access to 9 sub agents:
- python-test-explorer: all the times that test are going to be created have to consult this subagent
- shadcn-ui-architect: all task related to UI building & tweaking HAVE TO consult this agent
- qa-criteria-validator: all final client UI/UX implementations has to be validated by this subagent to provide feedback an iterate.
- ui-ux-analyzer: all the task related with UI review, improvements & tweaking HAVE TO consult this agent
- claude-sdk-expert: all implementations related with agents has to consult this subagent.
- frontend-developer: all task related to business logic in the client side before create the UI building & tweaking HAVE TO consult this agent
- frontend-test-engineer: all task related to business logic in the client side after implementation has to consult this agent to get the necesary test cases definitions
- backend-developer: all task related to business logic in the backend side HAVE TO consult this agent
- backend-test-engineer: all task related to business logic in the backned side after implementation has to consult this agent to get the necesary test cases definitions


Sub agents will do research about the implementation and report feedback, but you will do the actual implementation;
When passing task to sub agent, make sure you pass the context file, e.g. `.claude/sessions/context_session_{feature_name}.md`.
After each sub agent finish the work, make sure you read the related documentation they created to get full context of the plan before you start executing

## Code Writing

- YOU MUST ALWAYS address me as "Fran" in all communications.
- We STRONGLY prefer simple, clean, maintainable solutions over clever or complex ones. Readability and maintainability are PRIMARY CONCERNS, even at the cost of conciseness or performance.
- YOU MUST make the SMALLEST reasonable changes to achieve the desired outcome.
- YOU MUST MATCH the style and formatting of surrounding code, even if it differs from standard style guides. Consistency within a file trumps external standards.
- YOU MUST NEVER make code changes unrelated to your current task. If you notice something that should be fixed but is unrelated, document it rather than fixing it immediately.
- YOU MUST NEVER remove code comments unless you can PROVE they are actively false. Comments are important documentation and must be preserved.
- All code files MUST start with a brief 2-line comment explaining what the file does. Each line MUST start with "ABOUTME: " to make them easily greppable.
- YOU MUST NEVER refer to temporal context in comments (like "recently refactored"). Comments should be evergreen and describe the code as it is.
- YOU MUST NEVER throw away implementations to rewrite them without EXPLICIT permission. If you're considering this, YOU MUST STOP and ask first.
- YOU MUST NEVER use temporal naming conventions like 'improved', 'new', or 'enhanced'. All naming should be evergreen.
- YOU MUST NOT change whitespace unrelated to code you're modifying.

## Version Control

- For non-trivial edits, all changes MUST be tracked in git.
- If the project isn't in a git repo, YOU MUST STOP and ask permission to initialize one.
- If there are uncommitted changes or untracked files when starting work, YOU MUST STOP and ask how to handle them. Suggest committing existing work first.
- When starting work without a clear branch for the current task, YOU MUST create a WIP branch.
- YOU MUST commit frequently throughout the development process.

## Getting Help

- YOU MUST ALWAYS ask for clarification rather than making assumptions.
- If you're having trouble, YOU MUST STOP and ask for help, especially for tasks where human input would be valuable.

## Testing

- Tests MUST comprehensively cover ALL implemented functionality. 
- YOU MUST NEVER ignore system or test output - logs and messages often contain CRITICAL information.
- Test output MUST BE PRISTINE TO PASS.
- If logs are expected to contain errors, these MUST be captured and tested.
- NO EXCEPTIONS POLICY: ALL projects MUST have unit tests, integration tests, AND end-to-end tests. The only way to skip any test type is if Fran EXPLICITLY states: "I AUTHORIZE YOU TO SKIP WRITING TESTS THIS TIME."

## Compliance Check

Before submitting any work, verify that you have followed ALL guidelines above. If you find yourself considering an exception to ANY rule, YOU MUST STOP and get explicit permission from Fran first.