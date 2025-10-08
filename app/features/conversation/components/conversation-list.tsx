// ABOUTME: Conversation list component displaying all conversations with filtering.
// ABOUTME: Handles loading, empty, and error states with user-friendly messages.

"use client";

import { AlertCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationListItemComponent } from "./conversation-list-item";
import type { ConversationListItem } from "../data/schemas/conversation.schema";

interface ConversationListProps {
  conversations: ConversationListItem[];
  activeConversationId?: string;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onConversationClick: (conversationId: string) => void;
  onConversationDelete: (conversationId: string) => void;
  onRetry?: () => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  isLoading,
  isError,
  error,
  onConversationClick,
  onConversationDelete,
  onRetry,
}: ConversationListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold text-lg mb-2">Unable to load conversations</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message || "An error occurred while fetching conversations"}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No conversations yet</h3>
        <p className="text-sm text-muted-foreground">
          Start a new conversation to see it here
        </p>
      </div>
    );
  }

  // Conversation list
  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 p-2">
        {conversations.map((conversation) => (
          <ConversationListItemComponent
            key={conversation.id}
            conversation={conversation}
            isActive={conversation.id === activeConversationId}
            onClick={() => onConversationClick(conversation.id)}
            onDelete={() => onConversationDelete(conversation.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
