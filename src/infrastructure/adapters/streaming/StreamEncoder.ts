// ABOUTME: Encodes stream data according to Vercel Data Stream Protocol v1
// ABOUTME: Handles different message types and formatting

export class StreamEncoder {
  private readonly encoder: TextEncoder;

  constructor() {
    this.encoder = new TextEncoder();
  }

  /**
   * Encodes text content
   */
  encodeText(content: string): Uint8Array {
    const message = `0:${JSON.stringify(content)}\n`;
    return this.encoder.encode(message);
  }

  /**
   * Encodes tool call information
   */
  encodeToolCall(payload: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }): Uint8Array {
    const message = `9:${JSON.stringify({
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      args: payload.args,
    })}\n`;
    return this.encoder.encode(message);
  }

  /**
   * Encodes tool result
   */
  encodeToolResult(payload: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  }): Uint8Array {
    const message = `a:${JSON.stringify({
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      args: payload.args,
      result: payload.result,
    })}\n`;
    return this.encoder.encode(message);
  }

  /**
   * Encodes finish message with usage
   */
  encodeFinish(payload: {
    finishReason: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    isContinued?: boolean;
  }): Uint8Array {
    const message = `e:${JSON.stringify({
      finishReason: payload.finishReason,
      usage: payload.usage ? {
        promptTokens: payload.usage.promptTokens,
        completionTokens: payload.usage.completionTokens,
      } : undefined,
      isContinued: payload.isContinued || false,
    })}\n`;
    return this.encoder.encode(message);
  }

  /**
   * Encodes error message
   */
  encodeError(error: string): Uint8Array {
    const message = `3:"${error}"\n`;
    return this.encoder.encode(message);
  }

  /**
   * Encodes metadata message
   */
  encodeMetadata(metadata: Record<string, unknown>): Uint8Array {
    const message = `b:${JSON.stringify(metadata)}\n`;
    return this.encoder.encode(message);
  }

  /**
   * Encodes data message (generic)
   */
  encodeData(data: unknown): Uint8Array {
    const message = `d:${JSON.stringify(data)}\n`;
    return this.encoder.encode(message);
  }
}