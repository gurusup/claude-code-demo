# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application implementing AI chat streaming with hexagonal architecture. The application demonstrates Domain-Driven Design principles with clean separation between domain logic, application services, and infrastructure adapters.

## Architecture

### Tech Stack
- **Framework**: Next.js 13 with App Router (`app/` directory)
- **Architecture**: Hexagonal (Ports & Adapters) with Domain-Driven Design
- **AI Integration**: OpenAI SDK for chat completions
- **Streaming**: Vercel's Data Stream Protocol v1
- **State Management**: React Query (TanStack Query) + Vercel AI SDK
- **Testing**: Vitest with React Testing Library
- **UI Components**: shadcn/ui (new-york style)

### Hexagonal Architecture Layers

The codebase follows strict hexagonal architecture with three primary layers:

#### Backend
```
src/
  domain/              # Core business logic (framework-agnostic)
    entities/          # Aggregates (e.g., Conversation, Message)
    value-objects/     # Immutable domain concepts (MessageRole, ToolName)
    services/          # Domain services (ConversationOrchestrator)
    repositories/      # Repository interfaces
    exceptions/        # Domain-specific errors

  application/         # Use cases and application services
    use-cases/         # Business workflows (SendMessageUseCase, StreamChatCompletionUseCase)
    ports/
      inbound/         # Service interfaces exposed to presentation
      outbound/        # Interfaces for infrastructure dependencies
    dto/               # Data transfer objects
    mappers/           # DTO <-> Entity conversion

  infrastructure/      # Adapters and external integrations
    adapters/
      ai/              # OpenAI adapter
      streaming/       # Vercel stream adapter
      tools/           # Tool implementations
    repositories/      # Repository implementations
    config/            # DependencyContainer (IoC)
app/
  api/conversations/   # Next.js API route (thin controller)
```

#### Frontend
```
app/
  features/            # Feature-based organization for UI
    conversation/
      components/      # React components
      hooks/           # Business hooks (useConversation)
      data/            # Frontend data layer
```

### Key Architectural Principles

1. **Dependency Rule**: All dependencies point inward. Domain has zero dependencies on infrastructure.
2. **Ports & Adapters**: Infrastructure implements interfaces defined in application/ports
3. **Dependency Injection**: DependencyContainer manages all service instantiation
4. **Domain Entities**: Business rules enforced in entities (e.g., Conversation validates message ordering)

### Path Aliases (tsconfig.json)

```typescript
"@/*"              → Project root
"@/domain/*"       → ./src/domain/*
"@/application/*"  → ./src/application/*
"@/infrastructure/*" → ./src/infrastructure/*
"@/presentation/*" → ./src/presentation/*
"@/components"     → ./components (shadcn/ui)
"@/lib"            → ./lib
"@/hooks"          → ./hooks
```

## Development Commands

### Running the Application

```bash
yarn dev          # Development server on port 3000
yarn build        # Production build
yarn start        # Production server
```

### Testing

```bash
yarn test              # Run Vitest tests
yarn test:ui           # Run tests with UI
yarn test:coverage     # Run tests with coverage
```

### Linting

```bash
yarn lint         # ESLint
```

### Adding UI Components

```bash
npx shadcn-ui@latest add [component-name]
```

**Always use yarn instead of npm.**

## Environment Variables

Required in `.env`:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o model

## API Communication Flow

1. Frontend sends messages via `useConversation` hook → `/api/conversations`
2. API route delegates to use cases via DependencyContainer
3. `ManageConversationUseCase` creates/retrieves conversation entity
4. `SendMessageUseCase` adds user message to conversation
5. `StreamChatCompletionUseCase` orchestrates AI streaming:
   - Gets messages from conversation entity
   - Converts to OpenAI format via `OpenAIMessageConverter`
   - Streams response via `VercelStreamAdapter`
   - Executes tools via `ExecuteToolUseCase`
6. Frontend receives streaming response via Vercel AI SDK

## Key Technical Details

### Domain Entities

- **Conversation**: Aggregate root enforcing message ordering, status transitions, and conversation lifecycle
- **Message**: Entity with role validation, content, attachments, and tool invocations
- **Value Objects**: MessageRole, MessageContent, ToolName, Attachment, Coordinates

### Use Cases (Application Layer)

- `ManageConversationUseCase`: Create/retrieve conversations
- `SendMessageUseCase`: Add messages to conversations
- `StreamChatCompletionUseCase`: Stream AI responses
- `ExecuteToolUseCase`: Execute tool calls (e.g., weather)

### Frontend Architecture

The `useConversation` hook is the primary interface for chat functionality:
- Wraps Vercel AI SDK's `useChat` with business logic
- Manages conversation storage and metadata
- Provides derived state (isEmpty, isThinking, hasMessages)
- Handles error states with user-friendly messages

Located at: `app/features/conversation/hooks/useConversation.tsx:37`

### shadcn/ui Configuration

- Style: "new-york"
- Base color: zinc
- CSS variables enabled for theming
- Components auto-imported to `@/components/ui`

## Adding New Features

### Adding a New Tool

1. Create tool interface in `src/application/ports/outbound/` (e.g., `IWeatherService.ts`)
2. Implement tool in `src/infrastructure/adapters/tools/` (e.g., `WeatherTool.ts`)
3. Register in `ToolRegistry` (`src/infrastructure/adapters/tools/ToolRegistry.ts`)
4. Add to DependencyContainer if needed

### Adding a New Use Case

1. Define in `src/application/use-cases/`
2. Follow constructor injection pattern for dependencies
3. Add factory method to DependencyContainer
4. Call from API route controller

### Adding Frontend Components

Use shadcn/ui CLI:
```bash
npx shadcn-ui@latest add [component-name]
```

Components are automatically configured for the project's path aliases.

## Sub-Agent Workflow

## Rules
- After a plan mode phase you should create a `.claude/sessions/context_session_{feature_name}.md` with the definition of the plan
- Before you do any work, MUST view files in `.claude/sessions/context_session_{feature_name}.md` file and `.claude/doc/{feature_name}/*` files to get the full context (feature_name being the id of the session we are operate, if file doesnt exist, then create one)
- `.claude/sessions/context_session_{feature_name}.md` should contain most of context of what we did, overall plan, and sub agents will continusly add context to the file
- After you finish the work, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did
- After you finish the each phase, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did

## Sub-Agent Workflow
This project uses specialized sub-agents for different concerns. Always consult the appropriate agent:

- **shadcn-ui-architect**: UI building & component architecture
- **qa-criteria-validator**: Final UI/UX validation and feedback
- **ui-ux-analyzer**: UI review, improvements & tweaking
- **frontend-developer**: Client-side business logic
- **frontend-test-engineer**: Frontend test case definitions
- **typescript-test-explorer**: Test case design
- **hexagonal-backend-architect**: NextJS API & backend architecture
- **backend-test-architect**: Backend test definitions

Sub agents will do research about the implementation and report feedback, but you will do the actual implementation;
When passing task to sub agent, make sure you pass the context file, e.g. `.claude/sessions/context_session_{feature_name}.md`.
After each sub agent finish the work, make sure you read the related documentation they created to get full context of the plan before you start executing

## Code Writing Standards

- **Simplicity First**: Prefer simple, clean, maintainable solutions over clever ones
- **ABOUTME Comments**: All files must start with 2-line comment with "ABOUTME: " prefix
- **Minimal Changes**: Make smallest reasonable changes to achieve desired outcome
- **Style Matching**: Match existing code style/formatting within each file
- **Preserve Comments**: Never remove comments unless provably false
- **No Temporal Naming**: Avoid 'new', 'improved', 'enhanced', 'recently' in names/comments
- **Evergreen Documentation**: Comments describe code as it is, not its history

## Version Control

- Non-trivial edits must be tracked in git
- Create WIP branches for new work
- Commit frequently throughout development
- Never throw away implementations without explicit permission

## Testing Requirements

**NO EXCEPTIONS POLICY**: All projects MUST have:
- Unit tests

The only way to skip tests: Fran EXPLICITLY states "I AUTHORIZE YOU TO SKIP WRITING TESTS THIS TIME."

- Tests must comprehensively cover all functionality
- Test output must be pristine to pass
- Never ignore system/test output - logs contain critical information

## Architecture Compliance

When writing backend code:

1. **Keep Domain Pure**: Zero framework dependencies in `src/domain/`
2. **Define Ports First**: Interfaces in `src/application/ports/` before implementations
3. **Thin Controllers**: API routes delegate immediately to use cases
4. **Dependency Injection**: All dependencies injected via constructor
5. **Repository Pattern**: Data access only through repository interfaces

When writing frontend code:

1. **Container Pattern**: Separate business logic from presentation
2. **Custom Hooks**: Business logic in hooks (e.g., `useConversation`)
3. **Feature Organization**: Group by feature in `app/features/`
4. **Component Purity**: Components receive props, hooks manage state


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

- Always ask for clarification rather than making assumptions
- Stop and ask for help when stuck, especially when human input would be valuable
- If considering an exception to any rule, stop and get explicit permission from Fran first

## Testing

- Tests MUST comprehensively cover ALL implemented functionality. 
- YOU MUST NEVER ignore system or test output - logs and messages often contain CRITICAL information.
- Test output MUST BE PRISTINE TO PASS.
- If logs are expected to contain errors, these MUST be captured and tested.
- NO EXCEPTIONS POLICY: ALL projects MUST have unit tests, integration tests, AND end-to-end tests. The only way to skip any test type is if Fran EXPLICITLY states: "I AUTHORIZE YOU TO SKIP WRITING TESTS THIS TIME."


## Compliance Check
Before submitting any work, verify that you have followed ALL guidelines above. If you find yourself considering an exception to ANY rule, YOU MUST STOP and get explicit permission from Fran first.