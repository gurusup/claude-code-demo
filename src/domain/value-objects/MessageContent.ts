// ABOUTME: Value object representing message content with validation
// ABOUTME: Ensures content is non-empty and provides content manipulation methods

import { InvalidMessageError } from '../exceptions/InvalidMessageError';

export class MessageContent {
  private readonly value: string;

  private constructor(content: string) {
    this.validate(content);
    this.value = content;
  }

  static from(content: string): MessageContent {
    return new MessageContent(content);
  }

  static empty(): MessageContent {
    return new MessageContent('');
  }

  private validate(content: string): void {
    if (content === null || content === undefined) {
      throw new InvalidMessageError('Message content cannot be null or undefined');
    }
    if (typeof content !== 'string') {
      throw new InvalidMessageError('Message content must be a string');
    }
    // Allow empty string for tool messages or special cases
  }

  getValue(): string {
    return this.value;
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  getLength(): number {
    return this.value.length;
  }

  contains(substring: string): boolean {
    return this.value.includes(substring);
  }

  equals(other: MessageContent): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}