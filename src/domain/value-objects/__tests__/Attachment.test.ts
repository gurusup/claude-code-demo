// ABOUTME: Unit tests for Attachment value object
// ABOUTME: Tests attachment validation, type checking, and metadata handling

import { describe, it, expect } from 'vitest';
import { Attachment } from '../Attachment';

describe('Attachment', () => {
  describe('create()', () => {
    describe('Valid attachments', () => {
      it('should create attachment with valid parameters', () => {
        const attachment = Attachment.create(
          'photo.jpg',
          'image/jpeg',
          'https://example.com/photo.jpg'
        );
        expect(attachment.getName()).toBe('photo.jpg');
        expect(attachment.getContentType()).toBe('image/jpeg');
        expect(attachment.getUrl()).toBe('https://example.com/photo.jpg');
      });

      it('should accept PDF attachment', () => {
        const attachment = Attachment.create(
          'document.pdf',
          'application/pdf',
          'https://example.com/doc.pdf'
        );
        expect(attachment.getContentType()).toBe('application/pdf');
      });

      it('should accept text file attachment', () => {
        const attachment = Attachment.create(
          'readme.txt',
          'text/plain',
          'https://example.com/readme.txt'
        );
        expect(attachment.getContentType()).toBe('text/plain');
      });

      it('should accept video attachment', () => {
        const attachment = Attachment.create(
          'video.mp4',
          'video/mp4',
          'https://example.com/video.mp4'
        );
        expect(attachment.getContentType()).toBe('video/mp4');
      });

      it('should accept audio attachment', () => {
        const attachment = Attachment.create(
          'audio.mp3',
          'audio/mpeg',
          'https://example.com/audio.mp3'
        );
        expect(attachment.getContentType()).toBe('audio/mpeg');
      });

      it('should accept complex MIME types', () => {
        const attachment = Attachment.create(
          'data.json',
          'application/vnd.api+json',
          'https://example.com/data.json'
        );
        expect(attachment.getContentType()).toBe('application/vnd.api+json');
      });
    });

    describe('Invalid name validation', () => {
      it('should throw for empty name', () => {
        expect(() =>
          Attachment.create('', 'image/jpeg', 'https://example.com/image.jpg')
        ).toThrow('Attachment name must be a non-empty string');
      });

      it('should throw for null name', () => {
        expect(() =>
          Attachment.create(null as any, 'image/jpeg', 'https://example.com/image.jpg')
        ).toThrow('Attachment name must be a non-empty string');
      });

      it('should throw for undefined name', () => {
        expect(() =>
          Attachment.create(undefined as any, 'image/jpeg', 'https://example.com/image.jpg')
        ).toThrow('Attachment name must be a non-empty string');
      });

      it('should throw for non-string name', () => {
        expect(() =>
          Attachment.create(123 as any, 'image/jpeg', 'https://example.com/image.jpg')
        ).toThrow('Attachment name must be a non-empty string');
      });
    });

    describe('Invalid content type validation', () => {
      it('should throw for empty content type', () => {
        expect(() =>
          Attachment.create('file.jpg', '', 'https://example.com/file.jpg')
        ).toThrow('Content type must be a non-empty string');
      });

      it('should throw for null content type', () => {
        expect(() =>
          Attachment.create('file.jpg', null as any, 'https://example.com/file.jpg')
        ).toThrow('Content type must be a non-empty string');
      });

      it('should throw for undefined content type', () => {
        expect(() =>
          Attachment.create('file.jpg', undefined as any, 'https://example.com/file.jpg')
        ).toThrow('Content type must be a non-empty string');
      });

      it('should throw for content type without slash', () => {
        expect(() =>
          Attachment.create('file.jpg', 'imagejpeg', 'https://example.com/file.jpg')
        ).toThrow('Invalid content type format');
      });

      it('should throw for non-string content type', () => {
        expect(() =>
          Attachment.create('file.jpg', 123 as any, 'https://example.com/file.jpg')
        ).toThrow('Content type must be a non-empty string');
      });
    });

    describe('Invalid URL validation', () => {
      it('should throw for empty URL', () => {
        expect(() =>
          Attachment.create('file.jpg', 'image/jpeg', '')
        ).toThrow('URL must be a non-empty string');
      });

      it('should throw for null URL', () => {
        expect(() =>
          Attachment.create('file.jpg', 'image/jpeg', null as any)
        ).toThrow('URL must be a non-empty string');
      });

      it('should throw for undefined URL', () => {
        expect(() =>
          Attachment.create('file.jpg', 'image/jpeg', undefined as any)
        ).toThrow('URL must be a non-empty string');
      });

      it('should throw for non-string URL', () => {
        expect(() =>
          Attachment.create('file.jpg', 'image/jpeg', 123 as any)
        ).toThrow('URL must be a non-empty string');
      });
    });
  });

  describe('Type checking methods', () => {
    describe('isImage()', () => {
      it('should return true for JPEG image', () => {
        const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
        expect(attachment.isImage()).toBe(true);
      });

      it('should return true for PNG image', () => {
        const attachment = Attachment.create('photo.png', 'image/png', 'https://example.com/photo.png');
        expect(attachment.isImage()).toBe(true);
      });

      it('should return false for PDF', () => {
        const attachment = Attachment.create('doc.pdf', 'application/pdf', 'https://example.com/doc.pdf');
        expect(attachment.isImage()).toBe(false);
      });
    });

    describe('isText()', () => {
      it('should return true for plain text', () => {
        const attachment = Attachment.create('file.txt', 'text/plain', 'https://example.com/file.txt');
        expect(attachment.isText()).toBe(true);
      });

      it('should return true for HTML', () => {
        const attachment = Attachment.create('file.html', 'text/html', 'https://example.com/file.html');
        expect(attachment.isText()).toBe(true);
      });

      it('should return false for image', () => {
        const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
        expect(attachment.isText()).toBe(false);
      });
    });

    describe('isPdf()', () => {
      it('should return true for PDF', () => {
        const attachment = Attachment.create('doc.pdf', 'application/pdf', 'https://example.com/doc.pdf');
        expect(attachment.isPdf()).toBe(true);
      });

      it('should return false for image', () => {
        const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
        expect(attachment.isPdf()).toBe(false);
      });

      it('should return false for other application types', () => {
        const attachment = Attachment.create('data.json', 'application/json', 'https://example.com/data.json');
        expect(attachment.isPdf()).toBe(false);
      });
    });

    describe('isVideo()', () => {
      it('should return true for MP4 video', () => {
        const attachment = Attachment.create('video.mp4', 'video/mp4', 'https://example.com/video.mp4');
        expect(attachment.isVideo()).toBe(true);
      });

      it('should return true for WebM video', () => {
        const attachment = Attachment.create('video.webm', 'video/webm', 'https://example.com/video.webm');
        expect(attachment.isVideo()).toBe(true);
      });

      it('should return false for image', () => {
        const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
        expect(attachment.isVideo()).toBe(false);
      });
    });

    describe('isAudio()', () => {
      it('should return true for MP3 audio', () => {
        const attachment = Attachment.create('audio.mp3', 'audio/mpeg', 'https://example.com/audio.mp3');
        expect(attachment.isAudio()).toBe(true);
      });

      it('should return true for WAV audio', () => {
        const attachment = Attachment.create('audio.wav', 'audio/wav', 'https://example.com/audio.wav');
        expect(attachment.isAudio()).toBe(true);
      });

      it('should return false for video', () => {
        const attachment = Attachment.create('video.mp4', 'video/mp4', 'https://example.com/video.mp4');
        expect(attachment.isAudio()).toBe(false);
      });
    });
  });

  describe('equals()', () => {
    it('should return true for identical attachments', () => {
      const attachment1 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      const attachment2 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      expect(attachment1.equals(attachment2)).toBe(true);
    });

    it('should return false for different names', () => {
      const attachment1 = Attachment.create('file1.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      const attachment2 = Attachment.create('file2.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      expect(attachment1.equals(attachment2)).toBe(false);
    });

    it('should return false for different content types', () => {
      const attachment1 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      const attachment2 = Attachment.create('file.jpg', 'image/png', 'https://example.com/file.jpg');
      expect(attachment1.equals(attachment2)).toBe(false);
    });

    it('should return false for different URLs', () => {
      const attachment1 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file1.jpg');
      const attachment2 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file2.jpg');
      expect(attachment1.equals(attachment2)).toBe(false);
    });
  });

  describe('toObject()', () => {
    it('should return object representation', () => {
      const attachment = Attachment.create('photo.jpg', 'image/jpeg', 'https://example.com/photo.jpg');
      const obj = attachment.toObject();
      expect(obj).toEqual({
        name: 'photo.jpg',
        contentType: 'image/jpeg',
        url: 'https://example.com/photo.jpg',
      });
    });

    it('should return defensive copy', () => {
      const attachment = Attachment.create('file.txt', 'text/plain', 'https://example.com/file.txt');
      const obj1 = attachment.toObject();
      const obj2 = attachment.toObject();
      expect(obj1).not.toBe(obj2);
      expect(obj1).toEqual(obj2);
    });
  });

  describe('Immutability', () => {
    it('should create new instances for same values', () => {
      const attachment1 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      const attachment2 = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      expect(attachment1).not.toBe(attachment2);
      expect(attachment1.equals(attachment2)).toBe(true);
    });

    it('should have immutable properties', () => {
      const attachment = Attachment.create('file.jpg', 'image/jpeg', 'https://example.com/file.jpg');
      expect(attachment.getName()).toBe('file.jpg');
      expect(attachment.getContentType()).toBe('image/jpeg');
      expect(attachment.getUrl()).toBe('https://example.com/file.jpg');
    });
  });
});
