// ABOUTME: Domain exception for streaming-related failures
// ABOUTME: Thrown when stream operations violate business rules or fail

export class StreamingError extends Error {
  constructor(message: string, public readonly streamState?: string) {
    super(message);
    this.name = 'StreamingError';
    Object.setPrototypeOf(this, StreamingError.prototype);
  }
}