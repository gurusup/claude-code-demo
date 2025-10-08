// ABOUTME: Individual conversation item component for the sidebar list.
// ABOUTME: Displays conversation metadata with delete action and active state highlighting.

"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ConversationListItem } from "../data/schemas/conversation.schema";

interface ConversationListItemProps {
  conversation: ConversationListItem;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function ConversationListItemComponent({
  conversation,
  isActive,
  onClick,
  onDelete,
}: ConversationListItemProps) {
  const formatTimestamp = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full text-left p-3 rounded-lg transition-colors",
        "hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring",
        isActive && "bg-secondary border-l-4 border-l-primary"
      )}
      aria-label={`Open conversation: ${conversation.title}`}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className={cn(
              "text-sm font-medium line-clamp-1",
              isActive ? "text-primary" : "text-foreground"
            )}
            title={conversation.title}
          >
            {conversation.title}
          </h3>

          {/* Metadata */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(conversation.updatedAt)}
            </span>
            {conversation.status === "archived" && (
              <Badge variant="secondary" className="text-xs h-5">
                Archived
              </Badge>
            )}
          </div>
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:text-destructive hover:bg-destructive/10"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete conversation: ${conversation.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </button>
  );
}
