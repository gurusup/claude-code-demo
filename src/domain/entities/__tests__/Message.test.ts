// ABOUTME: Unit tests for Message entity
// ABOUTME: Tests message creation, validation rules, and sequence logic

import { describe, it, expect } from 'vitest';
import { Message } from '../Message';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';
import { Attachment } from '../../value-objects/Attachment';
import { ToolInvocation } from '../ToolInvocation';
import { ToolName } from '../../value-objects/ToolName';
import { InvalidMessageError } from '../../exceptions/InvalidMessageError';
import { MessageFactory } from '../../__test-helpers__/factories/MessageFactory';
import { ToolInvocationBuilder } from '../../__test-helpers__/builders/ToolInvocationBuilder';

describe('Message', () => {
  describe('create()', () => {
    it('should create message with role and content', () => {
      const role = MessageRole.user();
      const content = MessageContent.from('Hello');

      const message = Message.create(role, content);

      expect(message.getRole().equals(role)).toBe(true);
      expect(message.getContent().equals(content)).toBe(true);
      expect(message.getId()).toBeDefined();
      expect(message.getTimestamp()).toBeInstanceOf(Date);
    });

    it('should create message with attachments', () => {
      const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Check this photo'),
        [attachment]
      );

      expect(message.hasAttachments()).toBe(true);
      expect(message.getAttachments()).toHaveLength(1);
      expect(message.getAttachments()[0].equals(attachment)).toBe(true);
    });

    it('should create message with tool invocations', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .withToolName('get_weather')
        .build();

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Let me check the weather'),
        [],
        [toolInvocation]
      );

      expect(message.hasToolInvocations()).toBe(true);
      expect(message.getToolInvocations()).toHaveLength(1);
    });
  });

  describe('createWithId()', () => {
    it('should create message with specific ID', () => {
      const customId = 'msg_custom_123';
      const message = Message.createWithId(
        customId,
        MessageRole.user(),
        MessageContent.from('Test')
      );

      expect(message.getId()).toBe(customId);
    });

    it('should throw for empty ID', () => {
      expect(() =>
        Message.createWithId('', MessageRole.user(), MessageContent.from('Test'))
      ).toThrow(InvalidMessageError);
      expect(() =>
        Message.createWithId('', MessageRole.user(), MessageContent.from('Test'))
      ).toThrow('non-empty string');
    });

    it('should throw for null ID', () => {
      expect(() =>
        Message.createWithId(null as any, MessageRole.user(), MessageContent.from('Test'))
      ).toThrow(InvalidMessageError);
    });
  });

  describe('createToolMessage()', () => {
    it('should create tool message with call ID in metadata', () => {
      const toolCallId = 'call_abc123';
      const message = Message.createToolMessage(toolCallId, 'Tool result: success');

      expect(message.getRole().isTool()).toBe(true);
      expect(message.getContent().getValue()).toBe('Tool result: success');
      expect(message.getMetadata('tool_call_id')).toBe(toolCallId);
    });

    it('should create tool message with non-empty content', () => {
      const message = Message.createToolMessage('call_1', 'Result data');

      expect(message.getContent().isEmpty()).toBe(false);
    });
  });

  describe('Validation rules', () => {
    describe('Tool message validation', () => {
      it('should throw for tool message with empty content', () => {
        expect(() =>
          Message.create(MessageRole.tool(), MessageContent.from(''))
        ).toThrow(InvalidMessageError);
        expect(() =>
          Message.create(MessageRole.tool(), MessageContent.from(''))
        ).toThrow('must have non-empty content');
      });

      it('should allow tool message with non-empty content', () => {
        expect(() =>
          Message.create(MessageRole.tool(), MessageContent.from('Success'))
        ).not.toThrow();
      });
    });

    describe('Tool invocation validation', () => {
      it('should throw for system message with tool invocations', () => {
        const toolInvocation = new ToolInvocationBuilder().build();

        expect(() =>
          Message.create(MessageRole.system(), MessageContent.from('System'), [], [toolInvocation])
        ).toThrow(InvalidMessageError);
        expect(() =>
          Message.create(MessageRole.system(), MessageContent.from('System'), [], [toolInvocation])
        ).toThrow('cannot have tool invocations');
      });

      it('should throw for user message with tool invocations', () => {
        const toolInvocation = new ToolInvocationBuilder().build();

        expect(() =>
          Message.create(MessageRole.user(), MessageContent.from('User'), [], [toolInvocation])
        ).toThrow(InvalidMessageError);
        expect(() =>
          Message.create(MessageRole.user(), MessageContent.from('User'), [], [toolInvocation])
        ).toThrow('Only assistant messages');
      });

      it('should allow assistant message with tool invocations', () => {
        const toolInvocation = new ToolInvocationBuilder().build();

        expect(() =>
          Message.create(MessageRole.assistant(), MessageContent.from('Assistant'), [], [toolInvocation])
        ).not.toThrow();
      });
    });
  });

  describe('isValidAfter()', () => {
    describe('Tool message sequencing', () => {
      it('should allow tool message after assistant message with tool calls', () => {
        const toolInvocation = new ToolInvocationBuilder().build();
        const assistantMsg = Message.create(
          MessageRole.assistant(),
          MessageContent.from('Calling tool'),
          [],
          [toolInvocation]
        );
        const toolMsg = Message.create(MessageRole.tool(), MessageContent.from('Result'));

        expect(toolMsg.isValidAfter(assistantMsg)).toBe(true);
      });

      it('should reject tool message after assistant message without tool calls', () => {
        const assistantMsg = Message.create(
          MessageRole.assistant(),
          MessageContent.from('No tools')
        );
        const toolMsg = Message.create(MessageRole.tool(), MessageContent.from('Result'));

        expect(toolMsg.isValidAfter(assistantMsg)).toBe(false);
      });

      it('should reject tool message after user message', () => {
        const userMsg = Message.create(MessageRole.user(), MessageContent.from('Hello'));
        const toolMsg = Message.create(MessageRole.tool(), MessageContent.from('Result'));

        expect(toolMsg.isValidAfter(userMsg)).toBe(false);
      });
    });

    describe('Same role sequencing', () => {
      it('should reject consecutive user messages', () => {
        const userMsg1 = Message.create(MessageRole.user(), MessageContent.from('First'));
        const userMsg2 = Message.create(MessageRole.user(), MessageContent.from('Second'));

        expect(userMsg2.isValidAfter(userMsg1)).toBe(false);
      });

      it('should reject consecutive assistant messages', () => {
        const assistantMsg1 = Message.create(MessageRole.assistant(), MessageContent.from('First'));
        const assistantMsg2 = Message.create(MessageRole.assistant(), MessageContent.from('Second'));

        expect(assistantMsg2.isValidAfter(assistantMsg1)).toBe(false);
      });

      it('should allow consecutive system messages', () => {
        const systemMsg1 = Message.create(MessageRole.system(), MessageContent.from('First'));
        const systemMsg2 = Message.create(MessageRole.system(), MessageContent.from('Second'));

        expect(systemMsg2.isValidAfter(systemMsg1)).toBe(true);
      });

      it('should allow message after system message', () => {
        const systemMsg = Message.create(MessageRole.system(), MessageContent.from('System'));
        const userMsg = Message.create(MessageRole.user(), MessageContent.from('User'));

        expect(userMsg.isValidAfter(systemMsg)).toBe(true);
      });
    });

    describe('Valid alternating sequences', () => {
      it('should allow user message after assistant message', () => {
        const assistantMsg = Message.create(MessageRole.assistant(), MessageContent.from('Response'));
        const userMsg = Message.create(MessageRole.user(), MessageContent.from('Follow-up'));

        expect(userMsg.isValidAfter(assistantMsg)).toBe(true);
      });

      it('should allow assistant message after user message', () => {
        const userMsg = Message.create(MessageRole.user(), MessageContent.from('Question'));
        const assistantMsg = Message.create(MessageRole.assistant(), MessageContent.from('Answer'));

        expect(assistantMsg.isValidAfter(userMsg)).toBe(true);
      });
    });
  });

  describe('Tool invocation query methods', () => {
    it('should identify pending tool invocations', () => {
      const pendingTool = new ToolInvocationBuilder().pending().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Test'),
        [],
        [pendingTool]
      );

      expect(message.getPendingToolInvocations()).toHaveLength(1);
    });

    it('should identify active (executing) tool invocations', () => {
      const executingTool = new ToolInvocationBuilder().executing().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Test'),
        [],
        [executingTool]
      );

      expect(message.getActiveToolInvocations()).toHaveLength(1);
    });

    it('should identify completed tool invocations', () => {
      const completedTool = new ToolInvocationBuilder().completed({ data: 'result' }).build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Test'),
        [],
        [completedTool]
      );

      expect(message.getCompletedToolInvocations()).toHaveLength(1);
    });

    it('should check if all tool invocations are complete', () => {
      const completed1 = new ToolInvocationBuilder().completed().build();
      const completed2 = new ToolInvocationBuilder().completed().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Test'),
        [],
        [completed1, completed2]
      );

      expect(message.allToolInvocationsComplete()).toBe(true);
    });

    it('should return false if any tool invocation is not complete', () => {
      const completed = new ToolInvocationBuilder().completed().build();
      const pending = new ToolInvocationBuilder().pending().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Test'),
        [],
        [completed, pending]
      );

      expect(message.allToolInvocationsComplete()).toBe(false);
    });
  });

  describe('Attachment query methods', () => {
    it('should check if message has image attachments', () => {
      const imageAttachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Photo'),
        [imageAttachment]
      );

      expect(message.hasImageAttachments()).toBe(true);
    });

    it('should return false for non-image attachments', () => {
      const pdfAttachment = Attachment.create('doc.pdf', 'application/pdf', 'https://example.com/doc.pdf');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Document'),
        [pdfAttachment]
      );

      expect(message.hasImageAttachments()).toBe(false);
    });
  });

  describe('Metadata', () => {
    it('should add and retrieve metadata', () => {
      const message = MessageFactory.createValidUserMessage('Test');

      message.addMetadata('custom_key', 'custom_value');

      expect(message.getMetadata('custom_key')).toBe('custom_value');
    });

    it('should return undefined for non-existent metadata', () => {
      const message = MessageFactory.createValidUserMessage('Test');

      expect(message.getMetadata('non_existent')).toBeUndefined();
    });

    it('should allow different metadata types', () => {
      const message = MessageFactory.createValidUserMessage('Test');

      message.addMetadata('string', 'value');
      message.addMetadata('number', 42);
      message.addMetadata('boolean', true);
      message.addMetadata('object', { nested: 'data' });

      expect(message.getMetadata('string')).toBe('value');
      expect(message.getMetadata('number')).toBe(42);
      expect(message.getMetadata('boolean')).toBe(true);
      expect(message.getMetadata('object')).toEqual({ nested: 'data' });
    });
  });

  describe('Defensive copying', () => {
    it('should return defensive copy of attachments', () => {
      const attachment = Attachment.create('file.txt', 'text/plain', 'https://example.com/file.txt');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Test'),
        [attachment]
      );

      const attachments1 = message.getAttachments();
      const attachments2 = message.getAttachments();

      expect(attachments1).toEqual(attachments2);
      expect(attachments1).not.toBe(attachments2);
    });

    it('should return defensive copy of tool invocations', () => {
      const toolInvocation = new ToolInvocationBuilder().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Test'),
        [],
        [toolInvocation]
      );

      const tools1 = message.getToolInvocations();
      const tools2 = message.getToolInvocations();

      expect(tools1).toEqual(tools2);
      expect(tools1).not.toBe(tools2);
    });
  });

  describe('toObject()', () => {
    it('should convert message to object', () => {
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Hello')
      );

      const obj = message.toObject();

      expect(obj.id).toBeDefined();
      expect(obj.role).toBe('user');
      expect(obj.content).toBe('Hello');
      expect(obj.attachments).toEqual([]);
      expect(obj.toolInvocations).toEqual([]);
      expect(obj.timestamp).toBeDefined();
    });

    it('should include metadata when present', () => {
      const message = MessageFactory.createValidUserMessage('Test');
      message.addMetadata('key', 'value');

      const obj = message.toObject();

      expect(obj.metadata).toEqual({ key: 'value' });
    });

    it('should omit metadata when empty', () => {
      const message = MessageFactory.createValidUserMessage('Test');

      const obj = message.toObject();

      expect(obj.metadata).toBeUndefined();
    });
  });
});
