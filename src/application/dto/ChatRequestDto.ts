// ABOUTME: DTO for incoming chat requests from API clients
// ABOUTME: Defines the contract for chat API endpoints

import { ClientMessageDto } from './MessageDto';

export interface ChatRequestDto {
  conversationId?: string;
  messages: ClientMessageDto[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}