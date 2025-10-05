// ABOUTME: Value object representing a tool name with validation
// ABOUTME: Ensures tool names follow naming conventions and are non-empty

export class ToolName {
  private readonly value: string;

  private constructor(name: string) {
    this.validate(name);
    this.value = name;
  }

  static from(name: string): ToolName {
    return new ToolName(name);
  }

  private validate(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }
    if (name.trim().length === 0) {
      throw new Error('Tool name cannot be empty or whitespace');
    }
    if (name.length > 100) {
      throw new Error('Tool name cannot exceed 100 characters');
    }
    // Tool names should follow a naming convention (letters, numbers, underscores)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        'Tool name must start with a letter and contain only letters, numbers, and underscores'
      );
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ToolName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}