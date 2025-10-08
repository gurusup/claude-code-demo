// ABOUTME: API endpoint for listing conversations with filtering and pagination.
// ABOUTME: Returns conversation metadata without full message history for performance.

import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/src/infrastructure/config/container';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/list
 * Returns a list of conversations with optional filtering
 * Query params:
 * - status: filter by conversation status (active, archived, etc.)
 * - limit: max number of results (default: 100)
 * - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const repository = container.getConversationRepository();
    const conversations = await repository.findAll({
      status,
      limit: Math.min(limit, 100), // Cap at 100
      offset: Math.max(offset, 0),
    });

    // Map to response format
    const response = conversations.map((conversation) => ({
      id: conversation.getId(),
      title: conversation.getTitle() || 'New Conversation',
      status: conversation.getStatus(),
      messageCount: conversation.getMessageCount(),
      createdAt: conversation.getCreatedAt().toISOString(),
      updatedAt: conversation.getUpdatedAt().toISOString(),
    }));

    console.log(`[API] Listed ${response.length} conversations (status: ${status || 'all'})`);

    return NextResponse.json({
      conversations: response,
      total: response.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[API] Error listing conversations:', error);

    return NextResponse.json(
      {
        error: 'Failed to list conversations',
        message:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}
