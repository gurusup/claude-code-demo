// ABOUTME: API endpoint for single conversation operations (GET, DELETE).
// ABOUTME: Provides conversation details with full message history.

import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/src/infrastructure/config/container';

/**
 * GET /api/conversations/:id
 * Returns a single conversation with full message history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const container = await getContainer();

    const conversationId = params.id;
    const repository = container.getConversationRepository();
    const conversation = await repository.findById(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    console.log(`[API] Retrieved conversation ${conversationId} with ${conversation.getMessageCount()} messages`);

    return NextResponse.json({
      id: conversation.getId(),
      title: conversation.getTitle() || 'New Conversation',
      status: conversation.getStatus(),
      messages: conversation.getMessages().map((message) => ({
        id: message.getId(),
        role: message.getRole().getValue(),
        content: message.getContent().getValue(),
        createdAt: message.getTimestamp().toISOString(),
        attachments: message.getAttachments().map((att) => ({
          name: att.getName(),
          contentType: att.getContentType(),
          url: att.getUrl(),
        })),
        toolInvocations: message.getToolInvocations().map((tool) => ({
          toolCallId: tool.getCallId(),
          toolName: tool.getToolName().getValue(),
          args: tool.getArgs(),
          // Convert domain state to Vercel AI SDK state
          state: tool.getState() === 'completed' ? 'result' : tool.getState(),
          result: tool.getResult(),
        })),
      })),
      createdAt: conversation.getCreatedAt().toISOString(),
      updatedAt: conversation.getUpdatedAt().toISOString(),
    });
  } catch (error) {
    console.error(`[API] Error retrieving conversation:`, error);

    return NextResponse.json(
      {
        error: 'Failed to retrieve conversation',
        message:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation (hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const container = await getContainer();

    const conversationId = params.id;
    const repository = container.getConversationRepository();

    // Check if conversation exists before deleting
    const conversation = await repository.findById(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await repository.delete(conversationId);

    console.log(`[API] Deleted conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully',
      id: conversationId,
    });
  } catch (error) {
    console.error(`[API] Error deleting conversation:`, error);

    return NextResponse.json(
      {
        error: 'Failed to delete conversation',
        message:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}
