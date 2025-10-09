# Next.js AI Chat with Streaming

This is a Next.js application that demonstrates AI chat functionality with streaming responses using OpenAI's GPT-4o model and the Vercel AI SDK.

## Features

- 🚀 Pure Next.js implementation (no Python backend required)
- 💬 Real-time streaming chat responses
- 🛠️ Tool calling support (weather data example)
- 🎨 Modern UI with shadcn/ui components
- 🌓 Dark/Light theme support

## Tech Stack

- **Framework**: Next.js 13 with App Router
- **AI Integration**: OpenAI SDK + Vercel AI SDK
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ installed
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd cabify-demo
```

2. Install dependencies:
```bash
yarn install
# or
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Then edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your-openai-api-key-here
```

4. Run the development server:
```bash
yarn dev
# or
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
app/
  api/
    chat/          # API route for chat completions
  utils/           # TypeScript utilities and types
  (chat)/          # Chat interface pages
components/        # React components
  ui/              # shadcn/ui components
```

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn test` - Run tests with Vitest

## Environment Variables

- `OPENAI_API_KEY` =
- `REPOSITORY_TYPE`="mongodb"
- `MONGODB_URL`=
- `DATABASE_NAME`=

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)