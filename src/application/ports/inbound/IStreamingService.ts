// ABOUTME: Primary port for streaming operations
// ABOUTME: Defines how streaming responses are handled in the application

import { StreamingResponse } from '../../../domain/entities/StreamingResponse';

export interface IStreamingService {
  /**
   * Starts a new streaming session
   */
  startStreaming(conversationId: string): Promise<StreamingResponse>;

  /**
   * Processes streaming chunks
   */
  processChunk(
    streamingResponse: StreamingResponse,
    chunk: any
  ): Promise<void>;

  /**
   * Completes a streaming session
   */
  completeStreaming(
    streamingResponse: StreamingResponse,
    usage?: any
  ): Promise<void>;

  /**
   * Handles streaming errors
   */
  handleStreamError(
    streamingResponse: StreamingResponse,
    error: Error
  ): Promise<void>;
}