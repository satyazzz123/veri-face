import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ObjectStorage, UploadResult } from './storage.interface.js';
import { logger } from '../logger/logger.js';

export interface S3StorageConfig {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
  requestTimeoutMs?: number;
}

export class S3StorageAdapter implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;

    this.client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestHandler: {
        connectionTimeout: config.requestTimeoutMs ?? 5000,
        socketTimeout: config.requestTimeoutMs ?? 30000,
      },
    });
  }

  public generateOriginalKey(imageId: string, extension: string): string {
    const cleanExt = extension.replace(/^\./, '');
    return `originals/${imageId}.${cleanExt}`;
  }

  public generateProcessedKey(imageId: string, extension: string = 'jpeg'): string {
    const cleanExt = extension.replace(/^\./, '');
    return `processed/${imageId}.${cleanExt}`;
  }

  public async upload(
    key: string,
    body: Buffer | Uint8Array | Readable,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const buffer = body instanceof Buffer ? body : Buffer.isBuffer(body) ? body : Buffer.from(body as Uint8Array);
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      const response = await this.client.send(command);

      return {
        key,
        bucket: this.bucket,
        etag: response.ETag,
        contentType,
        size: buffer.length,
      };
    } catch (err: unknown) {
      logger.error({ err, key, bucket: this.bucket }, 'Failed to upload object to S3/MinIO');
      throw new Error(`Storage upload failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error(`Empty body returned for storage key "${key}"`);
      }

      // Convert stream to Buffer
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (err: unknown) {
      logger.error({ err, key, bucket: this.bucket }, 'Failed to download object from S3/MinIO');
      throw new Error(`Storage download failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async downloadStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error(`Empty stream returned for storage key "${key}"`);
      }

      return response.Body as Readable;
    } catch (err: unknown) {
      logger.error({ err, key, bucket: this.bucket }, 'Failed to get object stream from S3/MinIO');
      throw new Error(`Storage download stream failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      logger.info({ key, bucket: this.bucket }, 'Successfully deleted object from S3/MinIO');
    } catch (err: unknown) {
      logger.error({ err, key, bucket: this.bucket }, 'Failed to delete object from S3/MinIO');
      throw new Error(`Storage delete failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (err: unknown) {
      logger.error({ err, key, bucket: this.bucket }, 'Failed to generate presigned URL for S3/MinIO object');
      throw new Error(`Storage presigned URL generation failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
