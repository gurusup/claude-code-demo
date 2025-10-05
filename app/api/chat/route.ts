// ABOUTME: Next.js API route acting as thin controller delegating to use cases
// ABOUTME: Translates HTTP requests to domain operations and responses

import { NextRequest, NextResponse } from 'next/server';

import { randomUUID } from 'crypto';
import { DependencyContainer } from '@/src/infrastructure/config/DependencyContainer';
import { ChatRequestDto } from '@/src/application/dto/ChatRequestDto';
/**
 * POST /api/chat
 * Handles streaming chat completions with tool execution
 */
export async function POST(request: NextRequest) {
  let container: DependencyContainer;

  try {
    // Initialize container
    container = DependencyContainer.getInstance({
      enableLogging: process.env.NODE_ENV === 'development',
    });

    // Parse request body
    const body: ChatRequestDto = await request.json();

    // Generate or use provided conversation ID
    const conversationId = body.conversationId || randomUUID();

    // Get use cases
    const sendMessageUseCase = container.getSendMessageUseCase();
    const streamChatCompletionUseCase = container.getStreamChatCompletionUseCase();
    const manageConversationUseCase = container.getManageConversationUseCase();

    // Ensure conversation exists
    let conversation = await manageConversationUseCase.getConversation(conversationId);
    if (!conversation) {
      conversation = await manageConversationUseCase.createConversation();
    }

    // Add all messages to conversation
    if (body.messages && body.messages.length > 0) {
      await sendMessageUseCase.executeMultiple(conversation.getId(), body.messages);
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the chat completion
          await streamChatCompletionUseCase.execute(conversation.getId(), controller);
        } catch (error) {
          console.error('Streaming error:', error);

          // Send error through stream
          const errorData = {
            type: 'error',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
          };

          const streamAdapter = container.getStreamAdapter();
          streamAdapter.write(controller, errorData);
          streamAdapter.close(controller);
        }
      },
    });

    // Get streaming headers from adapter
    const streamAdapter = container.getStreamAdapter();
    const headers = streamAdapter.getHeaders();

    // Return streaming response
    return new NextResponse(stream, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('API route error:', error);

    // Handle initialization errors
    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service not configured. Please check your API keys.' },
        { status: 503 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development'
          ? (error as Error).message
          : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const container = DependencyContainer.getInstance({
      enableLogging: false,
    });

    const health = await container.healthCheck();

    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: (error as Error).message,
      },
      { status: 503 }
    );
  }
}