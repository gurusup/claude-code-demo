# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pure Next.js application demonstrating AI chat streaming using the OpenAI SDK and Vercel's Data Stream Protocol. The application provides AI chat completions with tool calling capabilities, all running within Next.js API routes.

## Architecture

### Tech Stack
- **Framework**: Next.js 13 with App Router (`app/` directory)
- **API Routes**: Next.js API routes for backend functionality
- **AI Integration**: OpenAI SDK for chat completions
- **Streaming**: Vercel's Data Stream Protocol v1

### API Communication Flow
1. Frontend sends ClientMessages to `/api/chat`
2. API route converts messages to OpenAI format
3. OpenAI SDK streams chat completion with tool calls
4. Stream is formatted using Data Stream Protocol v1
5. Frontend receives and displays streaming responses

### Directory Structure

```
app/
  api/
    chat/          # API route for chat completions
      route.ts     # Streaming chat endpoint
  utils/           # TypeScript utilities
    tools.ts       # Tool implementations (weather)
    types.ts       # Type definitions
    prompt.ts      # Message conversion utilities
  (chat)/          # Route group for chat interface
    page.tsx       # Main chat page
  layout.tsx       # Root layout
  globals.css      # Global styles with CSS variables

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

**Development**:
```bash
yarn dev
```

This starts the Next.js dev server on port 3000 with hot reload.

### Building and Testing

```bash
# Build for production
yarn build

# Start production server
yarn start

# Lint
yarn lint

# Run tests
yarn test

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

## Environment Variables

Required in `.env`:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o model

## Key Technical Details

### Path Aliases (tsconfig.json:22-24)
- `@/*` maps to project root
- Used throughout for clean imports: `@/components/chat`

### shadcn/ui Configuration (components.json)
- Style: "new-york"
- Base color: zinc
- CSS variables enabled for theming
- Components auto-imported to `@/components/ui`

### Streaming Protocol
The API route implements Vercel's Data Stream Protocol v1 (indicated by `x-vercel-ai-data-stream: v1` header). This allows:
- Incremental text streaming
- Tool call streaming with automatic execution
- Usage tracking (prompt/completion tokens)

## Adding New Features

### Adding a New Tool
1. Define function in `app/utils/tools.ts`
2. Add to `availableTools` object in `app/api/chat/route.ts`
3. Add tool definition to the `tools` array in the API route

### Adding Frontend Components
Use shadcn/ui CLI:
```bash
npx shadcn-ui@latest add [component-name]
```
Always use yarn instead of npm

### Modifying Message Types
Update interfaces in `app/utils/types.ts` and ensure `convertToOpenAIMessages()` in `app/utils/prompt.ts` handles the new format.


## Rules
- After a plan mode phase you should create a `.claude/sessions/context_session_{feature_name}.md` with the definition of the plan
- Before you do any work, MUST view files in `.claude/sessions/context_session_{feature_name}.md` file and `.claude/doc/{feature_name}/*` files to get the full context (feature_name being the id of the session we are operate, if file doesnt exist, then create one)
- `.claude/sessions/context_session_{feature_name}.md` should contain most of context of what we did, overall plan, and sub agents will continusly add context to the file
- After you finish the work, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did
- After you finish the each phase, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did

## Sub agents
You have access to 9 sub agents:
- shadcn-ui-architect: all task related to UI building & tweaking HAVE TO consult this agent
- qa-criteria-validator: all final client UI/UX implementations has to be validated by this subagent to provide feedback an iterate.
- ui-ux-analyzer: all the task related with UI review, improvements & tweaking HAVE TO consult this agent
- frontend-developer: all task related to business logic in the client side before create the UI building & tweaking HAVE TO consult this agent
- frontend-test-engineer: all task related to business logic in the client side after implementation has to consult this agent to get the necesary test cases definitions
- typescript-test-explorer: when test are needed HAVE TO consult this agent to define test cases
- hexagonal-backend-architect: all task related with NextJs api HAVE TO be implemented by this agent
- backend-test-architect: all task related to write test HAVE TO consult this agent


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