// ABOUTME: Value object representing a file attachment with metadata
// ABOUTME: Validates content type and URL format for attachments

export class Attachment {
  private readonly name: string;
  private readonly contentType: string;
  private readonly url: string;

  private constructor(name: string, contentType: string, url: string) {
    this.validate(name, contentType, url);
    this.name = name;
    this.contentType = contentType;
    this.url = url;
  }

  static create(name: string, contentType: string, url: string): Attachment {
    return new Attachment(name, contentType, url);
  }

  private validate(name: string, contentType: string, url: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Attachment name must be a non-empty string');
    }
    if (!contentType || typeof contentType !== 'string') {
      throw new Error('Content type must be a non-empty string');
    }
    if (!url || typeof url !== 'string') {
      throw new Error('URL must be a non-empty string');
    }
    // Basic MIME type validation
    if (!contentType.includes('/')) {
      throw new Error('Invalid content type format');
    }
  }

  getName(): string {
    return this.name;
  }

  getContentType(): string {
    return this.contentType;
  }

  getUrl(): string {
    return this.url;
  }

  isImage(): boolean {
    return this.contentType.startsWith('image/');
  }

  isText(): boolean {
    return this.contentType.startsWith('text/');
  }

  isPdf(): boolean {
    return this.contentType === 'application/pdf';
  }

  isVideo(): boolean {
    return this.contentType.startsWith('video/');
  }

  isAudio(): boolean {
    return this.contentType.startsWith('audio/');
  }

  equals(other: Attachment): boolean {
    return (
      this.name === other.name &&
      this.contentType === other.contentType &&
      this.url === other.url
    );
  }

  toObject(): { name: string; contentType: string; url: string } {
    return {
      name: this.name,
      contentType: this.contentType,
      url: this.url,
    };
  }
}