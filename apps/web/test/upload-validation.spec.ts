import { describe, it, expect } from 'vitest';
import { DEFAULT_LIMITS } from '@image-val/shared';

describe('Frontend Validation & State Management Tests', () => {
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

  function validateFrontendFile(fileName: string, fileSize: number, fileType: string): string | null {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.includes(ext);
    const hasValidMime = ALLOWED_MIME_TYPES.includes(fileType.toLowerCase()) || fileType === '';

    if (!hasValidExt && !hasValidMime) {
      return `Unsupported format (${ext || fileType}). Permitted types: JPEG, PNG, HEIC.`;
    }

    if (fileSize > DEFAULT_LIMITS.MAX_FILE_SIZE_BYTES) {
      return `File exceeds 10MB limit (${(fileSize / (1024 * 1024)).toFixed(1)} MB).`;
    }

    if (fileSize < DEFAULT_LIMITS.MIN_IMAGE_SIZE_BYTES) {
      return 'File too small (minimum 10 KB required).';
    }

    return null;
  }

  it('should accept valid JPEG file within size limits', () => {
    const error = validateFrontendFile('portrait.jpg', 2 * 1024 * 1024, 'image/jpeg');
    expect(error).toBeNull();
  });

  it('should accept valid PNG file within size limits', () => {
    const error = validateFrontendFile('id-card.png', 1 * 1024 * 1024, 'image/png');
    expect(error).toBeNull();
  });

  it('should accept valid Apple HEIC file', () => {
    const error = validateFrontendFile('IMG_2026.HEIC', 3 * 1024 * 1024, 'image/heic');
    expect(error).toBeNull();
  });

  it('should reject unsupported formats (e.g. GIF, PDF, BMP)', () => {
    expect(validateFrontendFile('animation.gif', 500 * 1024, 'image/gif')).toContain('Unsupported format');
    expect(validateFrontendFile('document.pdf', 500 * 1024, 'application/pdf')).toContain('Unsupported format');
    expect(validateFrontendFile('graphic.bmp', 500 * 1024, 'image/bmp')).toContain('Unsupported format');
  });

  it('should reject files exceeding 10MB', () => {
    const error = validateFrontendFile('huge-photo.jpg', 15 * 1024 * 1024, 'image/jpeg');
    expect(error).toContain('File exceeds 10MB limit');
  });

  it('should reject files smaller than 10KB', () => {
    const error = validateFrontendFile('empty.jpg', 1000, 'image/jpeg');
    expect(error).toContain('File too small');
  });
});
