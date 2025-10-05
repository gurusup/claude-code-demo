// ABOUTME: Data Transfer Object for message data across API boundaries
// ABOUTME: Decouples external API format from domain entities

export interface AttachmentDto {
  name: string;
  contentType: string;
  url: string;
}

export interface ToolInvocationDto {
  state: 'call' | 'partial-call' | 'result';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface MessageDto {
  id?: string;
  role: string;
  content: string;
  attachments?: AttachmentDto[];
  toolInvocations?: ToolInvocationDto[];
  timestamp?: string;
}

// This matches the client message format from the original implementation
export interface ClientMessageDto {
  role: string;
  content: string;
  experimental_attachments?: AttachmentDto[];
  toolInvocations?: ToolInvocationDto[];
}