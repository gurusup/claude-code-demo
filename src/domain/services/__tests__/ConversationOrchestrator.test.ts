// ABOUTME: Unit tests for ConversationOrchestrator domain service
// ABOUTME: Tests conversation workflow orchestration and business logic coordination

import { describe, it, expect, vi } from 'vitest';
import { ConversationOrchestrator } from '../ConversationOrchestrator';
import { MessageValidator } from '../MessageValidator';
import { Conversation, ConversationStatus } from '../../entities/Conversation';
import { Message } from '../../entities/Message';
import { StreamingResponse } from '../../entities/StreamingResponse';
import { ConversationError } from '../../exceptions/ConversationError';
import { InvalidMessageError } from '../../exceptions/InvalidMessageError';
import { ConversationBuilder } from '../../__test-helpers__/builders/ConversationBuilder';
import { MessageFactory } from '../../__test-helpers__/factories/MessageFactory';
import { ToolInvocationBuilder } from '../../__test-helpers__/builders/ToolInvocationBuilder';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';

describe('ConversationOrchestrator', () => {
  let orchestrator: ConversationOrchestrator;
  let mockValidator: MessageValidator;

  beforeEach(() => {
    mockValidator = new MessageValidator();
    orchestrator = new ConversationOrchestrator(mockValidator);
  });

  describe('prepareForStreaming()', () => {
    it('should prepare active conversation for streaming', () => {
      const conversation = Conversation.create();

      const context = orchestrator.prepareForStreaming(conversation);

      expect(context.conversation).toBe(conversation);
      expect(context.streamingResponse).toBeDefined();
      expect(context.pendingToolInvocations).toEqual([]);
    });

    it('should prepare waiting_for_response conversation', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Question')
        .waitingForResponse()
        .build();

      const context = orchestrator.prepareForStreaming(conversation);

      expect(context.streamingResponse).toBeDefined();
    });

    it('should throw for completed conversation', () => {
      const conversation = Conversation.create();
      conversation.markAsCompleted();

      expect(() => orchestrator.prepareForStreaming(conversation)).toThrow(ConversationError);
      expect(() => orchestrator.prepareForStreaming(conversation)).toThrow('completed state');
    });

    it('should throw for archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      expect(() => orchestrator.prepareForStreaming(conversation)).toThrow(ConversationError);
      expect(() => orchestrator.prepareForStreaming(conversation)).toThrow('archived state');
    });

    it('should throw for conversation with unresolved pending tools', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .withCallId('call_123')
        .build();

      const assistantMsg = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      conversation.addMessage(assistantMsg);

      expect(() => orchestrator.prepareForStreaming(conversation)).toThrow(ConversationError);
      expect(() => orchestrator.prepareForStreaming(conversation)).toThrow('tool invocations are pending');
    });

    it('should allow streaming when tool results are added', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .withCallId('call_123')
        .build();

      const assistantMsg = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );
      const toolResultMsg = Message.createToolMessage('call_123', 'Result');

      const conversation = Conversation.create();
      conversation.addMessage(assistantMsg);
      conversation.addMessage(toolResultMsg);

      expect(() => orchestrator.prepareForStreaming(conversation)).not.toThrow();
    });
  });

  describe('processUserMessage()', () => {
    it('should process valid user message', () => {
      const conversation = Conversation.create();
      const message = MessageFactory.createValidUserMessage('Hello');

      orchestrator.processUserMessage(conversation, message);

      expect(conversation.getMessageCount()).toBe(1);
      expect(conversation.getLastMessage()).toBe(message);
    });

    it('should throw for non-user message', () => {
      const conversation = Conversation.create();
      const message = MessageFactory.createValidAssistantMessage('Not user');

      expect(() => orchestrator.processUserMessage(conversation, message)).toThrow(InvalidMessageError);
      expect(() => orchestrator.processUserMessage(conversation, message)).toThrow('Expected user message');
    });

    it('should validate message before adding', () => {
      const conversation = Conversation.create();
      const spy = vi.spyOn(mockValidator, 'validate');
      const message = MessageFactory.createValidUserMessage('Test');

      orchestrator.processUserMessage(conversation, message);

      expect(spy).toHaveBeenCalledWith(message);
    });
  });

  describe('processAssistantMessage()', () => {
    it('should process valid assistant message', () => {
      const conversation = Conversation.create();
      const message = MessageFactory.createValidAssistantMessage('Response');

      const tools = orchestrator.processAssistantMessage(conversation, message);

      expect(conversation.getMessageCount()).toBe(1);
      expect(tools).toEqual([]);
    });

    it('should return tool invocations from message', () => {
      const toolInvocation = new ToolInvocationBuilder().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      const tools = orchestrator.processAssistantMessage(conversation, message);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(toolInvocation);
    });

    it('should throw for non-assistant message', () => {
      const conversation = Conversation.create();
      const message = MessageFactory.createValidUserMessage('Not assistant');

      expect(() => orchestrator.processAssistantMessage(conversation, message)).toThrow(InvalidMessageError);
      expect(() => orchestrator.processAssistantMessage(conversation, message)).toThrow('Expected assistant message');
    });

    it('should throw if streaming not completed and no tools', () => {
      const conversation = Conversation.create();
      const message = MessageFactory.createValidAssistantMessage('Response');
      const streamingResponse = StreamingResponse.create('stream_123');
      streamingResponse.start();

      expect(() =>
        orchestrator.processAssistantMessage(conversation, message, streamingResponse)
      ).toThrow(ConversationError);
      expect(() =>
        orchestrator.processAssistantMessage(conversation, message, streamingResponse)
      ).toThrow('must be completed');
    });

    it('should allow non-completed streaming if message has tools', () => {
      const toolInvocation = new ToolInvocationBuilder().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      const streamingResponse = StreamingResponse.create('stream_123');
      streamingResponse.start();

      expect(() =>
        orchestrator.processAssistantMessage(conversation, message, streamingResponse)
      ).not.toThrow();
    });
  });

  describe('processToolResults()', () => {
    it('should process completed tool invocations', () => {
      const conversation = Conversation.create();
      const toolInvocation = new ToolInvocationBuilder()
        .completed({ data: 'result' })
        .build();

      expect(() =>
        orchestrator.processToolResults(conversation, [toolInvocation])
      ).not.toThrow();
    });

    it('should throw for incomplete tool invocations', () => {
      const conversation = Conversation.create();
      const toolInvocation = new ToolInvocationBuilder()
        .pending()
        .build();

      expect(() =>
        orchestrator.processToolResults(conversation, [toolInvocation])
      ).toThrow(ConversationError);
      expect(() =>
        orchestrator.processToolResults(conversation, [toolInvocation])
      ).toThrow('incomplete tool invocations');
    });

    it('should throw for executing tool invocations', () => {
      const conversation = Conversation.create();
      const toolInvocation = new ToolInvocationBuilder()
        .executing()
        .build();

      expect(() =>
        orchestrator.processToolResults(conversation, [toolInvocation])
      ).toThrow(ConversationError);
    });
  });

  describe('canContinue()', () => {
    it('should return true for active conversation', () => {
      const conversation = Conversation.create();

      expect(orchestrator.canContinue(conversation)).toBe(true);
    });

    it('should return true for waiting_for_response', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Question')
        .waitingForResponse()
        .build();

      expect(orchestrator.canContinue(conversation)).toBe(true);
    });

    it('should return false for completed conversation', () => {
      const conversation = Conversation.create();
      conversation.markAsCompleted();

      expect(orchestrator.canContinue(conversation)).toBe(false);
    });

    it('should return false for archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      expect(orchestrator.canContinue(conversation)).toBe(false);
    });

    it('should return false for conversation at 1000 message limit', () => {
      const conversation = new ConversationBuilder()
        .withMessageCount(1000)
        .build();

      expect(orchestrator.canContinue(conversation)).toBe(false);
    });

    it('should return false for conversation with pending tools', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .withCallId('call_123')
        .build();

      const assistantMsg = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      conversation.addMessage(assistantMsg);

      expect(orchestrator.canContinue(conversation)).toBe(false);
    });
  });

  describe('suggestNextAction()', () => {
    it('should suggest complete for archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      expect(orchestrator.suggestNextAction(conversation)).toBe('complete');
    });

    it('should suggest complete for completed conversation', () => {
      const conversation = Conversation.create();
      conversation.markAsCompleted();

      expect(orchestrator.suggestNextAction(conversation)).toBe('complete');
    });

    it('should suggest process_tools for pending invocations', () => {
      const toolInvocation = new ToolInvocationBuilder().build();
      const assistantMsg = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      conversation.addMessage(assistantMsg);

      expect(orchestrator.suggestNextAction(conversation)).toBe('process_tools');
    });

    it('should suggest generate_response for waiting_for_response', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Question')
        .waitingForResponse()
        .build();

      expect(orchestrator.suggestNextAction(conversation)).toBe('generate_response');
    });

    it('should suggest wait_for_user for active conversation', () => {
      const conversation = Conversation.create();

      expect(orchestrator.suggestNextAction(conversation)).toBe('wait_for_user');
    });
  });

  describe('validateConversationIntegrity()', () => {
    it('should validate conversation with correct sequence', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Hello')
        .withAssistantMessage('Hi')
        .build();

      expect(() => orchestrator.validateConversationIntegrity(conversation)).not.toThrow();
    });

    it('should throw for invalid message sequence', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('First')
        .withUserMessage('Second')
        .build();

      expect(() => orchestrator.validateConversationIntegrity(conversation)).toThrow(ConversationError);
      expect(() => orchestrator.validateConversationIntegrity(conversation)).toThrow('Invalid message sequence');
    });

    it('should throw for orphaned tool message at start', () => {
      const conversation = Conversation.restore(
        'conv_123',
        [Message.createToolMessage('call_1', 'Result')],
        ConversationStatus.ACTIVE,
        new Date(),
        new Date()
      );

      expect(() => orchestrator.validateConversationIntegrity(conversation)).toThrow(ConversationError);
      expect(() => orchestrator.validateConversationIntegrity(conversation)).toThrow('without preceding assistant message');
    });
  });

  describe('calculateMetrics()', () => {
    it('should calculate metrics for empty conversation', () => {
      const conversation = Conversation.create();

      const metrics = orchestrator.calculateMetrics(conversation);

      expect(metrics).toEqual({
        messageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        toolInvocationCount: 0,
        averageResponseLength: 0,
        hasActiveTools: false,
      });
    });

    it('should calculate metrics for conversation with messages', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Hello')
        .withAssistantMessage('Hi there!')
        .withUserMessage('How are you?')
        .withAssistantMessage('I am good')
        .build();

      const metrics = orchestrator.calculateMetrics(conversation);

      expect(metrics.messageCount).toBe(4);
      expect(metrics.userMessageCount).toBe(2);
      expect(metrics.assistantMessageCount).toBe(2);
      expect(metrics.averageResponseLength).toBe(Math.round((9 + 9) / 2)); // "Hi there!" = 9, "I am good" = 9
    });

    it('should count tool invocations', () => {
      const toolInvocation = new ToolInvocationBuilder().build();
      const assistantMsg = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      conversation.addMessage(assistantMsg);

      const metrics = orchestrator.calculateMetrics(conversation);

      expect(metrics.toolInvocationCount).toBe(1);
    });

    it('should detect active tools', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .withCallId('call_123')
        .build();

      const assistantMsg = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      const conversation = Conversation.create();
      conversation.addMessage(assistantMsg);

      const metrics = orchestrator.calculateMetrics(conversation);

      expect(metrics.hasActiveTools).toBe(true);
    });
  });
});
