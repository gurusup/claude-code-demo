// ABOUTME: Domain service orchestrating complex conversation operations
// ABOUTME: Coordinates message flow, tool execution, and conversation state transitions

import { Conversation, ConversationStatus } from '../entities/Conversation';
import { Message } from '../entities/Message';
import { ToolInvocation } from '../entities/ToolInvocation';
import { StreamingResponse } from '../entities/StreamingResponse';
import { MessageValidator } from './MessageValidator';
import { ConversationError } from '../exceptions/ConversationError';
import { InvalidMessageError } from '../exceptions/InvalidMessageError';

export interface ConversationContext {
  conversation: Conversation;
  streamingResponse?: StreamingResponse;
  pendingToolInvocations: ToolInvocation[];
}

export class ConversationOrchestrator {
  private readonly messageValidator: MessageValidator;

  constructor(messageValidator?: MessageValidator) {
    this.messageValidator = messageValidator || new MessageValidator();
  }

  /**
   * Prepares a conversation for receiving a streaming response
   */
  prepareForStreaming(conversation: Conversation): ConversationContext {
    // Ensure conversation is in valid state
    if (!conversation.isActive() && !conversation.isWaitingForResponse()) {
      throw new ConversationError(
        `Cannot stream to conversation in ${conversation.getStatus()} state`,
        conversation.getId()
      );
    }

    // Check for unresolved tool invocations
    // Only block if there are pending tools WITHOUT corresponding tool messages
    if (conversation.hasPendingToolInvocations()) {
      // Check if tool results have been added as messages
      const hasToolResultMessages = this.checkForToolResultMessages(conversation);
      if (!hasToolResultMessages) {
        throw new ConversationError(
          'Cannot start new streaming while tool invocations are pending',
          conversation.getId()
        );
      }
    }

    const streamingResponse = StreamingResponse.create(
      `stream-${conversation.getId()}-${Date.now()}`
    );

    return {
      conversation,
      streamingResponse,
      pendingToolInvocations: [],
    };
  }

  /**
   * Checks if tool result messages exist for pending tool invocations
   */
  private checkForToolResultMessages(conversation: Conversation): boolean {
    const messages = conversation.getMessages();
    const lastAssistantMessage = conversation.getLastAssistantMessage();

    if (!lastAssistantMessage || !lastAssistantMessage.hasToolInvocations()) {
      return true; // No tools to check
    }

    const toolInvocations = lastAssistantMessage.getToolInvocations();
    const assistantMessageIndex = messages.lastIndexOf(lastAssistantMessage);

    // Check if there are tool messages after the assistant message
    for (let i = assistantMessageIndex + 1; i < messages.length; i++) {
      if (messages[i].getRole().isTool()) {
        return true; // Found at least one tool message
      }
    }

    return false; // No tool messages found
  }

  /**
   * Processes a user message and validates it can be added
   */
  processUserMessage(conversation: Conversation, message: Message): void {
    if (!message.getRole().isUser()) {
      throw new InvalidMessageError('Expected user message');
    }

    // Validate message
    this.messageValidator.validate(message);

    // Add to conversation (will perform additional validation)
    conversation.addMessage(message);
  }

  /**
   * Processes an assistant message with potential tool invocations
   */
  processAssistantMessage(
    conversation: Conversation,
    message: Message,
    streamingResponse?: StreamingResponse
  ): ToolInvocation[] {
    if (!message.getRole().isAssistant()) {
      throw new InvalidMessageError('Expected assistant message');
    }

    // Validate message
    this.messageValidator.validate(message);

    // If we have a streaming response, ensure it's either completed or has tool invocations
    // Tool invocations can be executed after the message is added but before the stream completes
    if (streamingResponse && !streamingResponse.isCompleted() && !message.hasToolInvocations()) {
      throw new ConversationError(
        'Streaming response must be completed before adding assistant message without tools',
        conversation.getId()
      );
    }

    // Add to conversation
    conversation.addMessage(message);

    // Return any tool invocations that need execution
    return [...message.getToolInvocations()];
  }

  /**
   * Processes tool execution results
   */
  processToolResults(
    conversation: Conversation,
    toolInvocations: ToolInvocation[]
  ): void {
    // Ensure all tool invocations are complete
    const incomplete = toolInvocations.filter(t => !t.isFinished());
    if (incomplete.length > 0) {
      throw new ConversationError(
        `Cannot process incomplete tool invocations: ${incomplete
          .map(t => t.getCallId())
          .join(', ')}`,
        conversation.getId()
      );
    }

    // Create tool result messages for each invocation
    for (const toolInvocation of toolInvocations) {
      if (toolInvocation.isCompleted()) {
        // Tool messages would be added here
        // This would typically be handled by the use case layer
      }
    }
  }

  /**
   * Determines if conversation can continue
   */
  canContinue(conversation: Conversation): boolean {
    // Check if conversation is in continuable state
    if (!conversation.isActive() && !conversation.isWaitingForResponse()) {
      return false;
    }

    // Check message count limits
    if (conversation.getMessageCount() >= 1000) {
      return false;
    }

    // Check for pending tool invocations
    if (conversation.hasPendingToolInvocations()) {
      return false;
    }

    return true;
  }

  /**
   * Suggests next action for conversation
   */
  suggestNextAction(conversation: Conversation): 'wait_for_user' | 'process_tools' | 'generate_response' | 'complete' {
    // If archived or completed, no action needed
    if (conversation.isArchived() || conversation.isCompleted()) {
      return 'complete';
    }

    // If there are pending tool invocations, process them
    if (conversation.hasPendingToolInvocations()) {
      return 'process_tools';
    }

    // If waiting for response, generate one
    if (conversation.isWaitingForResponse()) {
      return 'generate_response';
    }

    // Otherwise, wait for user input
    return 'wait_for_user';
  }

  /**
   * Validates conversation consistency
   */
  validateConversationIntegrity(conversation: Conversation): void {
    const messages = conversation.getMessages();

    // Validate message sequence
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];

      if (!current.isValidAfter(previous)) {
        throw new ConversationError(
          `Invalid message sequence at index ${i}: ${current.getRole().getValue()} cannot follow ${previous.getRole().getValue()}`,
          conversation.getId()
        );
      }
    }

    // Validate each message
    for (const message of messages) {
      try {
        this.messageValidator.validate(message);
      } catch (error) {
        throw new ConversationError(
          `Invalid message ${message.getId()}: ${(error as Error).message}`,
          conversation.getId()
        );
      }
    }

    // Check for orphaned tool results
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.getRole().isTool()) {
        // There should be a preceding assistant message with tool invocations
        if (i === 0) {
          throw new ConversationError(
            'Tool message found without preceding assistant message',
            conversation.getId()
          );
        }
        const previous = messages[i - 1];
        if (!previous.getRole().isAssistant() || !previous.hasToolInvocations()) {
          throw new ConversationError(
            `Tool message at index ${i} not preceded by assistant message with tool invocations`,
            conversation.getId()
          );
        }
      }
    }
  }

  /**
   * Calculates conversation metrics
   */
  calculateMetrics(conversation: Conversation): {
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    toolInvocationCount: number;
    averageResponseLength: number;
    hasActiveTools: boolean;
  } {
    const messages = conversation.getMessages();
    let totalToolInvocations = 0;
    let totalAssistantContentLength = 0;
    let assistantMessageCount = 0;

    for (const message of messages) {
      if (message.getRole().isAssistant()) {
        totalAssistantContentLength += message.getContent().getLength();
        assistantMessageCount++;
        totalToolInvocations += message.getToolInvocations().length;
      }
    }

    return {
      messageCount: conversation.getMessageCount(),
      userMessageCount: conversation.getUserMessageCount(),
      assistantMessageCount: conversation.getAssistantMessageCount(),
      toolInvocationCount: totalToolInvocations,
      averageResponseLength: assistantMessageCount > 0
        ? Math.round(totalAssistantContentLength / assistantMessageCount)
        : 0,
      hasActiveTools: conversation.hasPendingToolInvocations(),
    };
  }
}