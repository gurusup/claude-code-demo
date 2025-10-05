// ABOUTME: Unit tests for MessageValidator domain service
// ABOUTME: Tests cross-cutting validation rules and business constraints

import { describe, it, expect } from 'vitest';
import { MessageValidator } from '../MessageValidator';
import { Message } from '../../entities/Message';
import { MessageRole } from '../../value-objects/MessageRole';
import { MessageContent } from '../../value-objects/MessageContent';
import { Attachment } from '../../value-objects/Attachment';
import { InvalidMessageError } from '../../exceptions/InvalidMessageError';
import { MessageFactory } from '../../__test-helpers__/factories/MessageFactory';
import { ToolInvocationBuilder } from '../../__test-helpers__/builders/ToolInvocationBuilder';

describe('MessageValidator', () => {
  let validator: MessageValidator;

  beforeEach(() => {
    validator = new MessageValidator();
  });

  describe('isValid()', () => {
    it('should return true for valid message', () => {
      const message = MessageFactory.createValidUserMessage('Hello');

      expect(validator.isValid(message)).toBe(true);
    });

    it('should return false for invalid message', () => {
      const message = Message.create(MessageRole.user(), MessageContent.from(''));

      expect(validator.isValid(message)).toBe(false);
    });
  });

  describe('Content validation', () => {
    it('should validate message with valid content', () => {
      const message = MessageFactory.createValidUserMessage('Hello, world!');

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for content exceeding 32000 characters', () => {
      const longContent = 'A'.repeat(32001);
      const message = Message.create(MessageRole.user(), MessageContent.from(longContent));

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('exceeds maximum length');
    });

    it('should allow content with exactly 32000 characters', () => {
      const maxContent = 'A'.repeat(32000);
      const message = Message.create(MessageRole.user(), MessageContent.from(maxContent));

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for empty user message without attachments', () => {
      const message = Message.create(MessageRole.user(), MessageContent.from(''));

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('must have content or attachments');
    });

    it('should allow empty user message with attachments', () => {
      const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from(''),
        [attachment]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for empty assistant message without tool invocations', () => {
      const message = Message.create(MessageRole.assistant(), MessageContent.from(''));

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('must have content or tool invocations');
    });

    it('should allow empty assistant message with tool invocations', () => {
      const toolInvocation = new ToolInvocationBuilder().build();
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from(''),
        [],
        [toolInvocation]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });
  });

  describe('Attachment validation', () => {
    it('should validate message with valid attachment', () => {
      const attachment = Attachment.create('file.pdf', 'application/pdf', 'https://example.com/file.pdf');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Check this file'),
        [attachment]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for more than 10 attachments', () => {
      const attachments = Array.from({ length: 11 }, (_, i) =>
        Attachment.create(`file${i}.txt`, 'text/plain', `https://example.com/file${i}.txt`)
      );
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Many files'),
        attachments
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('cannot have more than 10 attachments');
    });

    it('should allow exactly 10 attachments', () => {
      const attachments = Array.from({ length: 10 }, (_, i) =>
        Attachment.create(`file${i}.txt`, 'text/plain', `https://example.com/file${i}.txt`)
      );
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Ten files'),
        attachments
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for non-user message with attachments', () => {
      const attachment = Attachment.create('file.txt', 'text/plain', 'https://example.com/file.txt');
      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Assistant with attachment'),
        [attachment]
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('Only user messages can have attachments');
    });

    it('should validate allowed image formats', () => {
      const allowedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      allowedFormats.forEach(format => {
        const attachment = Attachment.create('image.jpg', format, 'https://example.com/image.jpg');
        const message = Message.create(
          MessageRole.user(),
          MessageContent.from('Image'),
          [attachment]
        );

        expect(() => validator.validate(message)).not.toThrow();
      });
    });

    it('should throw for unsupported image format', () => {
      const attachment = Attachment.create('image.bmp', 'image/bmp', 'https://example.com/image.bmp');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('BMP image'),
        [attachment]
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('Unsupported image format');
    });

    it('should validate HTTP/HTTPS URLs', () => {
      const attachment = Attachment.create(
        'file.pdf',
        'application/pdf',
        'https://example.com/file.pdf'
      );
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Valid URL'),
        [attachment]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should validate data URLs', () => {
      const attachment = Attachment.create(
        'image.png',
        'image/png',
        'data:image/png;base64,iVBORw0KGgoAAAANS'
      );
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Data URL'),
        [attachment]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for invalid URL', () => {
      const attachment = Attachment.create('file.pdf', 'application/pdf', 'not-a-valid-url');
      const message = Message.create(
        MessageRole.user(),
        MessageContent.from('Invalid URL'),
        [attachment]
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('Invalid attachment URL');
    });
  });

  describe('Tool invocation validation', () => {
    it('should validate message with valid tool invocations', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .withCallId('call_1')
        .pending()
        .build();

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Calling tool'),
        [],
        [toolInvocation]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for more than 10 tool invocations', () => {
      const toolInvocations = Array.from({ length: 11 }, (_, i) =>
        new ToolInvocationBuilder()
          .withCallId(`call_${i}`)
          .build()
      );

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Many tools'),
        [],
        toolInvocations
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('cannot have more than 10 tool invocations');
    });

    it('should allow exactly 10 tool invocations', () => {
      const toolInvocations = Array.from({ length: 10 }, (_, i) =>
        new ToolInvocationBuilder()
          .withCallId(`call_${i}`)
          .build()
      );

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Ten tools'),
        [],
        toolInvocations
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for tool invocation in executing state', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .executing()
        .build();

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Tool'),
        [],
        [toolInvocation]
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('invalid state for a new message');
    });

    it('should throw for tool invocation in failed state', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .failed()
        .build();

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Tool'),
        [],
        [toolInvocation]
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('invalid state for a new message');
    });

    it('should allow completed tool invocations', () => {
      const toolInvocation = new ToolInvocationBuilder()
        .completed({ data: 'result' })
        .build();

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Tool completed'),
        [],
        [toolInvocation]
      );

      expect(() => validator.validate(message)).not.toThrow();
    });

    it('should throw for duplicate tool call IDs', () => {
      const toolInvocations = [
        new ToolInvocationBuilder().withCallId('call_1').build(),
        new ToolInvocationBuilder().withCallId('call_1').build(),
      ];

      const message = Message.create(
        MessageRole.assistant(),
        MessageContent.from('Duplicate IDs'),
        [],
        toolInvocations
      );

      expect(() => validator.validate(message)).toThrow(InvalidMessageError);
      expect(() => validator.validate(message)).toThrow('Duplicate tool call ID');
    });
  });

  describe('Role-specific validation', () => {
    describe('System messages', () => {
      it('should validate system message without attachments or tools', () => {
        const message = Message.create(
          MessageRole.system(),
          MessageContent.from('System message')
        );

        expect(() => validator.validate(message)).not.toThrow();
      });
    });

    describe('Tool messages', () => {
      it('should validate tool message with content', () => {
        const message = Message.createToolMessage('call_123', 'Tool result');

        expect(() => validator.validate(message)).not.toThrow();
      });
    });

    describe('User messages', () => {
      it('should validate user message with content', () => {
        const message = MessageFactory.createValidUserMessage('Hello');

        expect(() => validator.validate(message)).not.toThrow();
      });
    });

    describe('Assistant messages', () => {
      it('should validate assistant message with content', () => {
        const message = MessageFactory.createValidAssistantMessage('Response');

        expect(() => validator.validate(message)).not.toThrow();
      });

      it('should validate assistant message with tool invocations', () => {
        const toolInvocation = new ToolInvocationBuilder().build();
        const message = Message.create(
          MessageRole.assistant(),
          MessageContent.from('Calling tool'),
          [],
          [toolInvocation]
        );

        expect(() => validator.validate(message)).not.toThrow();
      });
    });
  });
});
