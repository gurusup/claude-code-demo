// ABOUTME: Next.js API route acting as thin controller delegating to use cases
// ABOUTME: Translates HTTP requests to domain operations and responses

import { NextRequest, NextResponse } from 'next/server';

import { randomUUID } from 'crypto';
import { getContainer } from '@/src/infrastructure/config/container';
import { ChatRequestDto } from '@/src/application/dto/ChatRequestDto';
/**
 * POST /api/conversations
 * Handles streaming chat completions with tool execution
 */
export async function POST(request: NextRequest) {
  try {
    // Get singleton container instance
    const container = await getContainer();

    // Parse request body
    const body: ChatRequestDto = await request.json();

    // Generate or use provided conversation ID
    const conversationId = body.conversationId || randomUUID();

    // Debug: Log API call
    console.log(`\n=== API CALL ===`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Messages count: ${body.messages?.length || 0}`);
    console.log(`Last message: ${body.messages?.slice(-1)[0]?.content?.substring(0, 50) || 'none'}`);
    console.log(`================\n`);

    // Get use cases
    const sendMessageUseCase = container.getSendMessageUseCase();
    const streamChatCompletionUseCase = container.getStreamChatCompletionUseCase();
    const manageConversationUseCase = container.getManageConversationUseCase();

    // Ensure conversation exists
    let conversation = await manageConversationUseCase.getConversation(conversationId);
    if (!conversation) {
      // Pass the conversationId to maintain consistency with frontend
      conversation = await manageConversationUseCase.createConversationWithId(conversationId);
    }

    // The useChat hook sends ALL messages each time
    // We need to only add NEW messages to avoid duplication
    if (body.messages && body.messages.length > 0) {
      const existingCount = conversation.getMessageCount();

      // Only process the last message if it's new (for continuing conversations)
      if (existingCount > 0) {
        // Get only the last user message that's new
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          await sendMessageUseCase.execute(conversation?.getId() || '', lastMessage);
        }
      } else {
        // For new conversations, just add the first user message
        const firstUserMessage = body.messages.find(m => m.role === 'user');
        if (firstUserMessage) {
          await sendMessageUseCase.execute(conversation?.getId() || '', firstUserMessage);
        }
      }
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;

        try {
          // Stream the chat completion
          await streamChatCompletionUseCase.execute(conversation?.getId() || '', controller);
          streamClosed = true; // Stream was closed by use case
        } catch (error) {
          console.error('Streaming error:', error);

          // Only try to write error if stream wasn't already closed
          if (!streamClosed) {
            try {
              // Send error through stream
              const errorData:any = {
                type: 'error',
                payload: {
                  error: error instanceof Error ? error.message : 'Unknown error occurred',
                },
              };

              const streamAdapter = container.getStreamAdapter();
              streamAdapter.write(controller, errorData);
              streamAdapter.close(controller);
            } catch (writeError) {
              console.error('Failed to write error to stream:', writeError);
            }
          }
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
 * GET /api/conversations
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();

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