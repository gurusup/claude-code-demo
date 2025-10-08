// ABOUTME: Zod schemas for conversation type validation and type inference
// ABOUTME: Provides runtime validation and TypeScript types for conversations

import { z } from 'zod';
import { MessagesSchema } from './message.schema';

/**
 * Schema for conversation metadata
 */
export const ConversationMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isArchived: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  lastMessageAt: z.string().datetime().optional(),
  messageCount: z.number().default(0),
});

/**
 * Schema for a complete conversation
 */
export const ConversationSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  messages: MessagesSchema.default([]),
  metadata: ConversationMetadataSchema.default(() => ({
    isArchived: false,
    isPinned: false,
    messageCount: 0,
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Schema for creating a new conversation
 */
export const CreateConversationSchema = z.object({
  metadata: ConversationMetadataSchema.optional(),
  initialMessage: z.string().optional(),
});

/**
 * Schema for updating conversation
 */
export const UpdateConversationSchema = z.object({
  metadata: ConversationMetadataSchema.optional(),
});

/**
 * Schema for conversation list response (matches backend API)
 */
export const ConversationListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  messageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ConversationListSchema = z.array(ConversationListItemSchema);

/**
 * Schema for conversation operations response
 */
export const ConversationOperationResponseSchema = z.object({
  success: z.boolean(),
  conversationId: z.string().optional(),
  error: z.string().optional(),
});

/**
 * TypeScript types inferred from schemas
 */
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationMetadata = z.infer<typeof ConversationMetadataSchema>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;
export type ConversationListItem = z.infer<typeof ConversationListItemSchema>;
export type ConversationList = z.infer<typeof ConversationListSchema>;
export type ConversationOperationResponse = z.infer<typeof ConversationOperationResponseSchema>;