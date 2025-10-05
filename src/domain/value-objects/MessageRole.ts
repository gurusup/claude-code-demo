// ABOUTME: Immutable value object representing message role with validation
// ABOUTME: Enforces valid role types and provides type-safe comparisons

import { InvalidMessageError } from '../exceptions/InvalidMessageError';

export class MessageRole {
  private static readonly VALID_ROLES = ['user', 'assistant', 'system', 'tool'] as const;
  private readonly value: typeof MessageRole.VALID_ROLES[number];

  private constructor(role: string) {
    if (!MessageRole.isValidRole(role)) {
      throw new InvalidMessageError(`Invalid role: ${role}`);
    }
    this.value = role as typeof MessageRole.VALID_ROLES[number];
  }

  static from(role: string): MessageRole {
    return new MessageRole(role);
  }

  static user(): MessageRole {
    return new MessageRole('user');
  }

  static assistant(): MessageRole {
    return new MessageRole('assistant');
  }

  static system(): MessageRole {
    return new MessageRole('system');
  }

  static tool(): MessageRole {
    return new MessageRole('tool');
  }

  private static isValidRole(role: string): boolean {
    return MessageRole.VALID_ROLES.includes(role as any);
  }

  isTool(): boolean {
    return this.value === 'tool';
  }

  isUser(): boolean {
    return this.value === 'user';
  }

  isAssistant(): boolean {
    return this.value === 'assistant';
  }

  isSystem(): boolean {
    return this.value === 'system';
  }

  getValue(): string {
    return this.value;
  }

  equals(other: MessageRole): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}