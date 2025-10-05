// ABOUTME: Domain exception for conversation-related violations
// ABOUTME: Thrown when conversation operations violate business rules

export class ConversationError extends Error {
  constructor(message: string, public readonly conversationId?: string) {
    super(message);
    this.name = 'ConversationError';
    Object.setPrototypeOf(this, ConversationError.prototype);
  }
}