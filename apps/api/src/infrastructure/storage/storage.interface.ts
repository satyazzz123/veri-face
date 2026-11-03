import { Readable } from 'stream';

export interface UploadResult {
  key: string;
  bucket: string;
  etag?: string;
  contentType: string;
  size: number;
}

export interface ObjectStorage {
  upload(
    key: string,
    body: Buffer | Uint8Array | Readable,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult>;

  download(key: string): Promise<Buffer>;

  downloadStream(key: string): Promise<Readable>;

  delete(key: string): Promise<void>;

  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  generateOriginalKey(imageId: string, extension: string): string;

  generateProcessedKey(imageId: string, extension: string): string;
}
