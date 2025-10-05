// ABOUTME: DTO for conversation data across API boundaries
// ABOUTME: Provides a simplified view of conversation for external consumers

import { MessageDto } from './MessageDto';

export interface ConversationDto {
  id: string;
  title?: string;
  messages: MessageDto[];
  status: 'active' | 'waiting_for_response' | 'completed' | 'archived';
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}