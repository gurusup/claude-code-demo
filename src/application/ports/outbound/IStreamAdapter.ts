// ABOUTME: Port for streaming response formatting and encoding
// ABOUTME: Abstracts away specific streaming protocols (Vercel, SSE, WebSocket)

export interface StreamData {
  type: 'text' | 'tool_call' | 'tool_result' | 'finish' | 'error';
  payload: unknown;
}

export interface IStreamAdapter {
  /**
   * Encodes stream data according to protocol
   */
  encode(data: StreamData): Uint8Array;

  /**
   * Creates response headers for streaming
   */
  getHeaders(): Record<string, string>;

  /**
   * Creates a readable stream
   */
  createStream(): ReadableStream<Uint8Array>;

  /**
   * Writes data to stream
   */
  write(controller: ReadableStreamDefaultController, data: StreamData): void;

  /**
   * Closes the stream
   */
  close(controller: ReadableStreamDefaultController): void;

  /**
   * Gets protocol name
   */
  getProtocol(): string;
}