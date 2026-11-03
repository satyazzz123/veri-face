import path from 'path';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import {
  ImageRecord,
  ImageStatus,
  PaginatedResult,
} from '@image-val/shared';
import { FormatValidator } from '@image-val/image-processing';
import { ObjectStorage } from '../../infrastructure/storage/storage.interface.js';
import { ImagesRepository, FindImagesParams } from './images.repository.js';
import { ImageValidationJobData } from '../../infrastructure/queue/bullmq-queue.js';
import { logger } from '../../infrastructure/logger/logger.js';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UploadBatchResult {
  uploadedImages: Array<{
    id: string;
    originalFilename: string;
    fileSize: number;
    status: ImageStatus;
  }>;
}

export class ImagesService {
  private readonly formatValidator: FormatValidator;

  constructor(
    private readonly repository: ImagesRepository,
    private readonly storage: ObjectStorage,
    private readonly queue: Queue<ImageValidationJobData>
  ) {
    this.formatValidator = new FormatValidator();
  }

  public async uploadImages(files: UploadedFile[]): Promise<UploadBatchResult> {
    if (!files || files.length === 0) {
      throw new Error('No files provided in upload request.');
    }

    const uploadedImages: Array<{
      id: string;
      originalFilename: string;
      fileSize: number;
      status: ImageStatus;
    }> = [];

    for (const file of files) {
      const imageId = crypto.randomUUID();
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const storedFilename = `${imageId}${ext}`;
      const originalStorageKey = this.storage.generateOriginalKey(imageId, ext);

      // Pre-validate file signature (magic bytes) to reject immediately if completely invalid
      const detectedMagic = this.formatValidator.detectMagicBytes(file.buffer);
      if (detectedMagic === 'UNKNOWN') {
        throw new Error(
          `File "${file.originalname}" has an invalid or unrecognized file signature. Only JPEG, PNG, and HEIC files are allowed.`
        );
      }

      // 1. Upload original binary to S3/MinIO
      await this.storage.upload(
        originalStorageKey,
        file.buffer,
        file.mimetype || 'application/octet-stream',
        {
          originalFilename: file.originalname,
          imageId,
        }
      );

      // 2. Persist initial metadata in PostgreSQL
      const record = await this.repository.create({
        id: imageId,
        originalFilename: file.originalname,
        storedFilename,
        originalMimeType: file.mimetype || 'image/jpeg',
        fileSize: file.size,
        originalStorageKey,
        status: ImageStatus.PROCESSING,
      });

      // 3. Dispatch BullMQ background processing job
      await this.queue.add(
        'validate-image',
        {
          imageId,
          storageKey: originalStorageKey,
          originalFilename: file.originalname,
          mimeType: file.mimetype || 'image/jpeg',
          fileSize: file.size,
        },
        {
          jobId: imageId, // Ensures idempotency per imageId
        }
      );

      logger.info({ imageId, filename: file.originalname }, 'Enqueued image for validation');

      uploadedImages.push({
        id: record.id,
        originalFilename: record.originalFilename,
        fileSize: record.fileSize,
        status: record.status,
      });
    }

    return { uploadedImages };
  }

  public async getImage(id: string): Promise<ImageRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      const err = new Error(`Image with ID "${id}" was not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    // Attach signed preview URLs
    try {
      record.signedOriginalUrl = await this.storage.getSignedUrl(record.originalStorageKey, 3600);
      if (record.processedStorageKey) {
        record.signedProcessedUrl = await this.storage.getSignedUrl(record.processedStorageKey, 3600);
      }
    } catch (err) {
      logger.warn({ err, id }, 'Could not generate signed preview URLs');
    }

    return record;
  }

  public async getImageStatus(id: string): Promise<{
    id: string;
    status: ImageStatus;
    rejectionReasons: string[];
    blurScore: number | null;
    faceCount: number | null;
    processedAt: Date | string | null;
  }> {
    const record = await this.repository.findById(id);
    if (!record) {
      const err = new Error(`Image with ID "${id}" was not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    return {
      id: record.id,
      status: record.status,
      rejectionReasons: record.rejectionReasons,
      blurScore: record.blurScore,
      faceCount: record.faceCount,
      processedAt: record.processedAt,
    };
  }

  public async listImages(params: FindImagesParams): Promise<PaginatedResult<ImageRecord>> {
    const result = await this.repository.findMany(params);

    // Attach signed URLs in parallel for efficient preview rendering
    await Promise.all(
      result.items.map(async (item) => {
        try {
          // If processed storage key exists (e.g. converted HEIC or optimized), prefer it for preview
          if (item.processedStorageKey) {
            item.signedProcessedUrl = await this.storage.getSignedUrl(item.processedStorageKey, 3600);
          }
          item.signedOriginalUrl = await this.storage.getSignedUrl(item.originalStorageKey, 3600);
        } catch {
          // Fall back gracefully if storage is unreachable
        }
      })
    );

    return result;
  }

  public async deleteImage(id: string): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      const err = new Error(`Image with ID "${id}" was not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    // 1. Soft delete database record
    await this.repository.softDelete(id);

    // 2. Delete storage objects safely
    try {
      if (record.originalStorageKey) {
        await this.storage.delete(record.originalStorageKey);
      }
      if (record.processedStorageKey) {
        await this.storage.delete(record.processedStorageKey);
      }
    } catch (err) {
      logger.error({ err, id }, 'Failed to delete one or more storage objects for image');
    }
  }
}
