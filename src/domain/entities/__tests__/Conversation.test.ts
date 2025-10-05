// ABOUTME: Unit tests for Conversation aggregate root
// ABOUTME: Tests conversation lifecycle, message validation, and business rules

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Conversation, ConversationStatus } from '../Conversation';
import { Message } from '../Message';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';
import { ConversationError } from '../../exceptions/ConversationError';
import { InvalidMessageError } from '../../exceptions/InvalidMessageError';
import { ConversationBuilder } from '../../__test-helpers__/builders/ConversationBuilder';
import { MessageFactory } from '../../__test-helpers__/factories/MessageFactory';
import { ToolInvocationBuilder } from '../../__test-helpers__/builders/ToolInvocationBuilder';

describe('Conversation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create()', () => {
    it('should create conversation with auto-generated ID', () => {
      const conversation = Conversation.create();

      expect(conversation.getId()).toBeDefined();
      expect(conversation.getStatus()).toBe(ConversationStatus.ACTIVE);
      expect(conversation.getMessageCount()).toBe(0);
      expect(conversation.getCreatedAt()).toBeInstanceOf(Date);
    });

    it('should create conversation with custom ID', () => {
      const conversation = Conversation.create('conv_custom_123');

      expect(conversation.getId()).toBe('conv_custom_123');
    });

    it('should have no title initially', () => {
      const conversation = Conversation.create();

      expect(conversation.getTitle()).toBeUndefined();
    });
  });

  describe('restore()', () => {
    it('should restore conversation with all properties', () => {
      const messages = [
        MessageFactory.createValidUserMessage('Hello'),
        MessageFactory.createValidAssistantMessage('Hi there'),
      ];
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02');

      const conversation = Conversation.restore(
        'conv_123',
        messages,
        ConversationStatus.ACTIVE,
        createdAt,
        updatedAt,
        'Test Conversation'
      );

      expect(conversation.getId()).toBe('conv_123');
      expect(conversation.getMessages()).toHaveLength(2);
      expect(conversation.getStatus()).toBe(ConversationStatus.ACTIVE);
      expect(conversation.getCreatedAt()).toBe(createdAt);
      expect(conversation.getUpdatedAt()).toBe(updatedAt);
      expect(conversation.getTitle()).toBe('Test Conversation');
    });
  });

  describe('addMessage()', () => {
    it('should add valid user message', () => {
      const conversation = Conversation.create();
      const message = MessageFactory.createValidUserMessage('Hello');

      conversation.addMessage(message);

      expect(conversation.getMessageCount()).toBe(1);
      expect(conversation.getLastMessage()).toBe(message);
    });

    it('should update status to WAITING_FOR_RESPONSE after user message', () => {
      const conversation = Conversation.create();
      const userMessage = MessageFactory.createValidUserMessage('Question');

      conversation.addMessage(userMessage);

      expect(conversation.isWaitingForResponse()).toBe(true);
    });

    it('should update status to ACTIVE after assistant message', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Question')
        .waitingForResponse()
        .build();

      const assistantMessage = MessageFactory.createValidAssistantMessage('Answer');
      conversation.addMessage(assistantMessage);

      expect(conversation.isActive()).toBe(true);
    });

    it('should update updatedAt when adding message', () => {
      vi.useFakeTimers();
      const initialTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(initialTime);

      const conversation = Conversation.create();

      vi.setSystemTime(new Date('2024-01-01T10:00:05Z'));
      conversation.addMessage(MessageFactory.createValidUserMessage('Test'));

      expect(conversation.getUpdatedAt().getTime()).toBeGreaterThan(initialTime.getTime());
    });

    it('should auto-generate title from first user message', () => {
      const conversation = Conversation.create();
      const userMessage = MessageFactory.createValidUserMessage('What is the weather?');

      conversation.addMessage(userMessage);

      expect(conversation.getTitle()).toBe('What is the weather?');
    });

    it('should truncate long titles to 50 characters', () => {
      const conversation = Conversation.create();
      const longContent = 'A'.repeat(100);
      const userMessage = MessageFactory.createValidUserMessage(longContent);

      conversation.addMessage(userMessage);

      expect(conversation.getTitle()).toHaveLength(53); // 50 + '...'
      expect(conversation.getTitle()).toContain('...');
    });

    it('should use only first line for title', () => {
      const conversation = Conversation.create();
      const multilineContent = 'First line\nSecond line\nThird line';
      const userMessage = MessageFactory.createValidUserMessage(multilineContent);

      conversation.addMessage(userMessage);

      expect(conversation.getTitle()).toBe('First line');
    });

    it('should not override existing title', () => {
      const conversation = new ConversationBuilder()
        .withTitle('Existing Title')
        .build();

      conversation.addMessage(MessageFactory.createValidUserMessage('New message'));

      expect(conversation.getTitle()).toBe('Existing Title');
    });
  });

  describe('Message limit validation', () => {
    it('should throw when exceeding 1000 messages', () => {
      const conversation = new ConversationBuilder()
        .withMessageCount(1000)
        .build();

      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Over limit'))
      ).toThrow(ConversationError);
      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Over limit'))
      ).toThrow('maximum message limit');
    });

    it('should allow exactly 1000 messages', () => {
      const conversation = new ConversationBuilder()
        .withMessageCount(999)
        .build();

      expect(() =>
        conversation.addMessage(MessageFactory.createValidAssistantMessage('1000th message'))
      ).not.toThrow();
    });
  });

  describe('Status validation', () => {
    it('should throw when adding message to archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Test'))
      ).toThrow(ConversationError);
      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Test'))
      ).toThrow('archived conversation');
    });

    it('should throw when adding message to completed conversation', () => {
      const conversation = Conversation.create();
      conversation.markAsCompleted();

      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Test'))
      ).toThrow(ConversationError);
      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Test'))
      ).toThrow('completed conversation');
    });
  });

  describe('Message sequence validation', () => {
    it('should throw for invalid message sequence', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('First')
        .build();

      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Second'))
      ).toThrow(InvalidMessageError);
      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('Second'))
      ).toThrow('cannot follow');
    });

    it('should allow valid alternating sequence', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Question')
        .build();

      expect(() =>
        conversation.addMessage(MessageFactory.createValidAssistantMessage('Answer'))
      ).not.toThrow();
    });
  });

  describe('Pending tool invocations', () => {
    it('should detect pending tool invocations', () => {
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

      expect(conversation.hasPendingToolInvocations()).toBe(true);
    });

    it('should return false when tool invocations resolved', () => {
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

      expect(conversation.hasPendingToolInvocations()).toBe(false);
    });

    it('should throw when adding non-tool message with pending tools', () => {
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

      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('User message'))
      ).toThrow(ConversationError);
      expect(() =>
        conversation.addMessage(MessageFactory.createValidUserMessage('User message'))
      ).toThrow('pending');
    });

    it('should allow tool message with pending tools', () => {
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

      expect(() =>
        conversation.addMessage(Message.createToolMessage('call_123', 'Result'))
      ).not.toThrow();
    });
  });

  describe('markAsCompleted()', () => {
    it('should mark active conversation as completed', () => {
      const conversation = Conversation.create();

      conversation.markAsCompleted();

      expect(conversation.isCompleted()).toBe(true);
    });

    it('should throw when completing archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      expect(() => conversation.markAsCompleted()).toThrow(ConversationError);
      expect(() => conversation.markAsCompleted()).toThrow('archived conversation');
    });
  });

  describe('archive()', () => {
    it('should archive active conversation', () => {
      const conversation = Conversation.create();

      conversation.archive();

      expect(conversation.isArchived()).toBe(true);
    });

    it('should archive completed conversation', () => {
      const conversation = Conversation.create();
      conversation.markAsCompleted();

      conversation.archive();

      expect(conversation.isArchived()).toBe(true);
    });

    it('should throw when archiving already archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      expect(() => conversation.archive()).toThrow(ConversationError);
      expect(() => conversation.archive()).toThrow('already archived');
    });
  });

  describe('reactivate()', () => {
    it('should reactivate archived conversation', () => {
      const conversation = Conversation.create();
      conversation.archive();

      conversation.reactivate();

      expect(conversation.isActive()).toBe(true);
    });

    it('should throw when reactivating non-archived conversation', () => {
      const conversation = Conversation.create();

      expect(() => conversation.reactivate()).toThrow(ConversationError);
      expect(() => conversation.reactivate()).toThrow('only reactivate archived');
    });
  });

  describe('Message retrieval', () => {
    it('should get last message', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('First')
        .withAssistantMessage('Second')
        .build();

      const lastMessage = conversation.getLastMessage();

      expect(lastMessage?.getRole().isAssistant()).toBe(true);
    });

    it('should return null when no messages', () => {
      const conversation = Conversation.create();

      expect(conversation.getLastMessage()).toBeNull();
    });

    it('should get last user message', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('User 1')
        .withAssistantMessage('Assistant')
        .withUserMessage('User 2')
        .withAssistantMessage('Assistant 2')
        .build();

      const lastUserMessage = conversation.getLastUserMessage();

      expect(lastUserMessage?.getContent().getValue()).toBe('User 2');
    });

    it('should get last assistant message', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('User')
        .withAssistantMessage('Assistant 1')
        .withUserMessage('User 2')
        .withAssistantMessage('Assistant 2')
        .build();

      const lastAssistantMessage = conversation.getLastAssistantMessage();

      expect(lastAssistantMessage?.getContent().getValue()).toBe('Assistant 2');
    });
  });

  describe('Message counting', () => {
    it('should count all messages', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('1')
        .withAssistantMessage('2')
        .withUserMessage('3')
        .build();

      expect(conversation.getMessageCount()).toBe(3);
    });

    it('should count user messages', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('1')
        .withAssistantMessage('2')
        .withUserMessage('3')
        .withAssistantMessage('4')
        .build();

      expect(conversation.getUserMessageCount()).toBe(2);
    });

    it('should count assistant messages', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('1')
        .withAssistantMessage('2')
        .withAssistantMessage('3')
        .build();

      expect(conversation.getAssistantMessageCount()).toBe(2);
    });
  });

  describe('setTitle()', () => {
    it('should set conversation title', () => {
      const conversation = Conversation.create();

      conversation.setTitle('New Title');

      expect(conversation.getTitle()).toBe('New Title');
    });

    it('should throw for empty title', () => {
      const conversation = Conversation.create();

      expect(() => conversation.setTitle('')).toThrow(ConversationError);
      expect(() => conversation.setTitle('')).toThrow('non-empty string');
    });

    it('should throw for null title', () => {
      const conversation = Conversation.create();

      expect(() => conversation.setTitle(null as any)).toThrow(ConversationError);
    });
  });

  describe('Metadata', () => {
    it('should add and retrieve metadata', () => {
      const conversation = Conversation.create();

      conversation.addMetadata('key', 'value');

      expect(conversation.getMetadata('key')).toBe('value');
    });

    it('should return undefined for non-existent metadata', () => {
      const conversation = Conversation.create();

      expect(conversation.getMetadata('non_existent')).toBeUndefined();
    });
  });

  describe('Defensive copying', () => {
    it('should return defensive copy of messages', () => {
      const conversation = new ConversationBuilder()
        .withUserMessage('Test')
        .build();

      const messages1 = conversation.getMessages();
      const messages2 = conversation.getMessages();

      expect(messages1).toEqual(messages2);
      expect(messages1).not.toBe(messages2);
    });
  });

  describe('toObject()', () => {
    it('should convert conversation to object', () => {
      const conversation = new ConversationBuilder()
        .withId('conv_123')
        .withUserMessage('Hello')
        .withTitle('Test Conversation')
        .build();

      const obj = conversation.toObject();

      expect(obj.id).toBe('conv_123');
      expect(obj.messages).toHaveLength(1);
      expect(obj.status).toBe(ConversationStatus.ACTIVE);
      expect(obj.title).toBe('Test Conversation');
      expect(obj.messageCount).toBe(1);
      expect(obj.createdAt).toBeDefined();
      expect(obj.updatedAt).toBeDefined();
    });

    it('should omit undefined title', () => {
      const conversation = Conversation.create();

      const obj = conversation.toObject();

      expect(obj.title).toBeUndefined();
    });
  });
});
