// ABOUTME: TypeScript interfaces for MongoDB conversation documents.
// ABOUTME: Maps domain entities to MongoDB document structure with embedded messages.

import { ConversationStatus } from "@/domain/entities/Conversation";

export interface MessageDocument {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  attachments?: AttachmentDocument[];
  toolInvocations?: ToolInvocationDocument[];
}

export interface AttachmentDocument {
  name: string;
  contentType: string;
  url: string;
}

export interface ToolInvocationDocument {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: string;
}

export interface ConversationDocument {
  _id: string;
  title: string;
  status: ConversationStatus;
  messages: MessageDocument[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
}
