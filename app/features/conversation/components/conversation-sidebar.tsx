// ABOUTME: Main conversation sidebar component with filtering and new conversation button.
// ABOUTME: Integrates with React Query hooks and shadcn sidebar components.

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConversationList } from "./conversation-list";
import { useConversationsListQuery } from "../hooks/queries/useConversationQuery";
import { useDeleteConversationMutation } from "../hooks/mutations/useConversationMutation";
import { useConversationStorage } from "../hooks/useConversationStorage";

interface ConversationSidebarProps {
  onNewConversation: () => void;
  onConversationSelect: (conversationId: string) => void;
}

export function ConversationSidebar({
  onNewConversation,
  onConversationSelect,
}: ConversationSidebarProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const { conversationId: activeConversationId } = useConversationStorage();

  // Query for conversation list
  const {
    data: conversations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useConversationsListQuery({
    status: statusFilter,
    limit: 100,
  });

  // Delete mutation
  const deleteMutation = useDeleteConversationMutation();

  const handleDelete = () => {
    if (conversationToDelete) {
      deleteMutation.mutate(conversationToDelete);
      setConversationToDelete(null);
    }
  };

  const handleNewConversation = () => {
    onNewConversation();
  };

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect(conversationId);
  };

  return (
    <>
      <Sidebar>
        {/* Header with New Chat button */}
        <SidebarHeader className="p-4">
          <Button
            onClick={handleNewConversation}
            className="w-full"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Chat
          </Button>

          <Separator className="mt-4" />
        </SidebarHeader>

        {/* Conversation list */}
        <SidebarContent>
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId || undefined}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onConversationClick={handleConversationClick}
            onConversationDelete={setConversationToDelete}
            onRetry={refetch}
          />
        </SidebarContent>

        {/* Footer (optional) */}
        <SidebarFooter className="p-4">
          <p className="text-xs text-muted-foreground text-center">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </SidebarFooter>
      </Sidebar>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={conversationToDelete !== null}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
