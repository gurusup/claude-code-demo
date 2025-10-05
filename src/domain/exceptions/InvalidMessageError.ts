// ABOUTME: Domain exception for invalid message validation errors
// ABOUTME: Thrown when message content, role, or structure violates business rules

export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMessageError';
    // Maintains proper stack trace for where error was thrown
    Object.setPrototypeOf(this, InvalidMessageError.prototype);
  }
}