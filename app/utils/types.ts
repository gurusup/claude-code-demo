// ABOUTME: Type definitions for client messages and tool invocations

export enum ToolInvocationState {
  CALL = 'call',
  PARTIAL_CALL = 'partial-call',
  RESULT = 'result'
}

export interface ToolInvocation {
  state: ToolInvocationState;
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
}

export interface ClientAttachment {
  name: string;
  contentType: string;
  url: string;
}

export interface ClientMessage {
  role: string;
  content: string;
  experimental_attachments?: ClientAttachment[];
  toolInvocations?: ToolInvocation[];
}