import { describe, it, expect, vi } from 'vitest';
import { S3StorageAdapter } from '../src/infrastructure/storage/s3-storage.adapter.js';

describe('S3 / MinIO Storage Adapter', () => {
  const adapter = new S3StorageAdapter({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucket: 'test-bucket',
    forcePathStyle: true,
  });

  it('should generate proper UUID-based keys for original uploads', () => {
    const key = adapter.generateOriginalKey('f47ac10b-58cc-4372-a567-0e02b2c3d479', '.jpg');
    expect(key).toBe('originals/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg');
  });

  it('should generate proper UUID-based keys for processed images', () => {
    const key = adapter.generateProcessedKey('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'jpeg');
    expect(key).toBe('processed/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpeg');
  });

  it('should handle extension formatting with or without leading dot', () => {
    const key1 = adapter.generateOriginalKey('123', 'png');
    const key2 = adapter.generateOriginalKey('123', '.png');
    expect(key1).toBe('originals/123.png');
    expect(key2).toBe('originals/123.png');
  });
});
