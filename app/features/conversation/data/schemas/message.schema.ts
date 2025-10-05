// ABOUTME: Zod schemas for message type validation and type inference
// ABOUTME: Provides runtime validation and TypeScript types for chat messages

import { z } from 'zod';

/**
 * Schema for tool invocation within a message
 */
export const ToolInvocationSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.any()).optional(),
  result: z.any().optional(),
});

/**
 * Schema for message attachments (files, images, etc.)
 */
export const AttachmentSchema = z.object({
  url: z.string().optional(),
  name: z.string(),
  contentType: z.string().optional(),
  file: z.instanceof(File).optional(),
});

/**
 * Schema for individual chat messages
 * Compatible with Vercel AI SDK Message type
 */
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'function', 'data', 'tool']),
  content: z.string(),
  createdAt: z.date().optional(),
  annotations: z.array(z.any()).optional(),
  toolInvocations: z.array(ToolInvocationSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  experimental_attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Schema for an array of messages (conversation history)
 */
export const MessagesSchema = z.array(MessageSchema);

/**
 * Schema for message creation (without ID, as it will be generated)
 */
export const CreateMessageSchema = MessageSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});

/**
 * Schema for message updates
 */
export const UpdateMessageSchema = MessageSchema.partial();

/**
 * TypeScript types inferred from schemas
 */
export type Message = z.infer<typeof MessageSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;