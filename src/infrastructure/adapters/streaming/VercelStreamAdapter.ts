// ABOUTME: Implements IStreamAdapter for Vercel's Data Stream Protocol v1
// ABOUTME: Handles encoding and formatting of stream data according to protocol

import { IStreamAdapter, StreamData } from '../../../application/ports/outbound/IStreamAdapter';
import { StreamEncoder } from './StreamEncoder';

export class VercelStreamAdapter implements IStreamAdapter {
  private readonly encoder: StreamEncoder;

  constructor() {
    this.encoder = new StreamEncoder();
  }

  encode(data: StreamData): Uint8Array {
    switch (data.type) {
      case 'text':
        return this.encoder.encodeText(data.payload as string);

      case 'tool_call':
        return this.encoder.encodeToolCall(data.payload as {
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
        });

      case 'tool_result':
        return this.encoder.encodeToolResult(data.payload as {
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
          result: unknown;
        });

      case 'finish':
        return this.encoder.encodeFinish(data.payload as {
          finishReason: string;
          usage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          };
          isContinued?: boolean;
        });

      case 'error':
        return this.encoder.encodeError((data.payload as { error: string }).error);

      default:
        // Generic data encoding
        return this.encoder.encodeData(data.payload);
    }
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };
  }

  createStream(): ReadableStream<Uint8Array> {
    // Create a new readable stream
    return new ReadableStream<Uint8Array>({
      start(controller) {
        // Stream is ready
        // Controller will be used by write and close methods
      },
      cancel() {
        // Handle stream cancellation
        console.log('Stream cancelled');
      },
    });
  }

  write(controller: ReadableStreamDefaultController, data: StreamData): void {
    try {
      const encoded = this.encode(data);
      controller.enqueue(encoded);
    } catch (error) {
      console.error('Failed to write to stream:', error);
      controller.error(error);
    }
  }

  close(controller: ReadableStreamDefaultController): void {
    try {
      controller.close();
    } catch (error) {
      // Controller might already be closed
      console.warn('Stream controller already closed:', error);
    }
  }

  getProtocol(): string {
    return 'vercel-data-stream-v1';
  }
}