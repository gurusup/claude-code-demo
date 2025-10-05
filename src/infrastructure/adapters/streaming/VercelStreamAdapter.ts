// ABOUTME: Implements IStreamAdapter for Vercel's Data Stream Protocol v1
// ABOUTME: Handles encoding and formatting of stream data according to protocol

import { IStreamAdapter, StreamData } from '../../../application/ports/outbound/IStreamAdapter';
import { StreamEncoder } from './StreamEncoder';

export class VercelStreamAdapter implements IStreamAdapter {
  private readonly encoder: StreamEncoder;
  private closedControllers: WeakSet<ReadableStreamDefaultController>;

  constructor() {
    this.encoder = new StreamEncoder();
    this.closedControllers = new WeakSet();
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
    // Check if controller is already closed
    if (this.closedControllers.has(controller)) {
      console.warn('Attempted to write to closed stream controller');
      return;
    }

    try {
      const encoded = this.encode(data);
      controller.enqueue(encoded);
    } catch (error) {
      // Check for "Controller is already closed" error
      if (error instanceof Error && error.message.includes('Controller is already closed')) {
        console.warn('Stream controller already closed, marking as closed');
        this.closedControllers.add(controller);
      } else {
        console.error('Failed to write to stream:', error);
        try {
          controller.error(error);
        } catch {
          // Ignore if controller is already closed
        }
      }
    }
  }

  close(controller: ReadableStreamDefaultController): void {
    // Check if already closed
    if (this.closedControllers.has(controller)) {
      console.warn('Controller already marked as closed');
      return;
    }

    try {
      controller.close();
      this.closedControllers.add(controller);
    } catch (error) {
      // Controller might already be closed
      console.warn('Stream controller already closed:', error);
      this.closedControllers.add(controller);
    }
  }

  getProtocol(): string {
    return 'vercel-data-stream-v1';
  }
}