// ABOUTME: DTO for chat responses sent to API clients
// ABOUTME: Standardizes response format across different providers

import { MessageDto } from './MessageDto';

export interface ChatResponseDto {
  conversationId: string;
  message?: MessageDto;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  error?: string;
}