import dotenv from 'dotenv';
import path from 'path';
import { Worker, Job } from 'bullmq';
import {
  ImageStatus,
  ImageValidationContext,
} from '@image-val/shared';
import { getPrismaClient } from '@image-val/database';
import { ValidationPipeline } from '@image-val/image-processing';
import {
  IMAGE_VALIDATION_QUEUE_NAME,
  ImageValidationJobData,
  getRedisConnection,
} from '../infrastructure/queue/bullmq-queue.js';
import { S3StorageAdapter } from '../infrastructure/storage/s3-storage.adapter.js';
import { ImagesRepository } from '../modules/images/images.repository.js';
import { sseManager } from '../utils/sse-manager.js';
import { logger } from '../infrastructure/logger/logger.js';

// Load environment configuration
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export function createImageProcessingWorker(): Worker<ImageValidationJobData> {
  const redisConnection = getRedisConnection();
  const prisma = getPrismaClient();
  const repository = new ImagesRepository(prisma);

  const storage = new S3StorageAdapter({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    bucket: process.env.S3_BUCKET || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });

  const pipeline = new ValidationPipeline({
    similarity: {
      threshold: parseInt(process.env.SIMILARITY_THRESHOLD || '8', 10),
      candidateProvider: repository,
    },
    blur: {
      threshold: parseFloat(process.env.BLUR_THRESHOLD || '100'),
    },
    face: {
      minAreaRatio: parseFloat(process.env.FACE_MIN_AREA_RATIO || '0.05'),
    },
  });

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

  const worker = new Worker<ImageValidationJobData>(
    IMAGE_VALIDATION_QUEUE_NAME,
    async (job: Job<ImageValidationJobData>) => {
      const { imageId, storageKey, originalFilename, mimeType, fileSize } = job.data;
      const startTime = Date.now();

      logger.info(
        { jobId: job.id, imageId, attempt: job.attemptsMade + 1 },
        'Starting image validation job'
      );

      // Record attempt start in DB
      await repository.recordProcessingAttempt({
        imageId,
        attemptNumber: job.attemptsMade + 1,
        status: 'PROCESSING',
      });

      // Step 1: Download original binary from S3/MinIO
      const originalBuffer = await storage.download(storageKey);

      // Construct validation context
      const context: ImageValidationContext = {
        imageId,
        originalBuffer,
        originalFilename,
        mimeType,
        fileSize,
        rejectionReasons: [],
        validationResults: [],
      };

      // Step 2: Execute modular 15-step validation pipeline
      const result = await pipeline.execute(context);

      // Step 3: If an auxiliary processed buffer exists (e.g. converted HEIC to JPEG), upload it
      let processedStorageKey: string | undefined;
      if (result.processedBuffer) {
        processedStorageKey = storage.generateProcessedKey(imageId, 'jpeg');
        await storage.upload(
          processedStorageKey,
          result.processedBuffer,
          'image/jpeg',
          { originalFilename, imageId }
        );
      }

      // Step 4: Persist validation results and status in PostgreSQL
      const updatedRecord = await repository.updateValidationResult(imageId, {
        status: result.status,
        rejectionReasons: result.rejectionReasons,
        detectedFormat: result.detectedFormat,
        width: result.width,
        height: result.height,
        blurScore: result.blurScore,
        faceCount: result.faceCount,
        faceBoundingBoxes: result.faces,
        perceptualHash: result.perceptualHash,
        processedStorageKey,
        validationResults: result.validationResults,
      });

      // Record attempt completion
      const durationMs = Date.now() - startTime;
      await repository.recordProcessingAttempt({
        imageId,
        attemptNumber: job.attemptsMade + 1,
        status: result.status,
        durationMs,
      });

      // Step 5: Generate signed preview URL if processed and notify real-time clients via SSE
      let signedProcessedUrl: string | null = null;
      if (processedStorageKey) {
        try {
          signedProcessedUrl = await storage.getSignedUrl(processedStorageKey, 3600);
        } catch {
          // Ignore signed URL error on notification
        }
      }

      sseManager.notifyImageStatus({
        imageId,
        status: result.status,
        rejectionReasons: result.rejectionReasons,
        blurScore: result.blurScore,
        faceCount: result.faceCount,
        perceptualHash: result.perceptualHash,
        signedProcessedUrl,
        updatedAt: new Date().toISOString(),
      });

      logger.info(
        {
          jobId: job.id,
          imageId,
          status: result.status,
          durationMs,
          rejections: result.rejectionReasons,
        },
        'Image validation job finished'
      );

      return {
        imageId,
        status: result.status,
        rejectionReasons: result.rejectionReasons,
      };
    },
    {
      connection: redisConnection as any,
      concurrency,
    }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { imageId } = job.data;
    logger.error(
      { jobId: job.id, imageId, attemptsMade: job.attemptsMade, err },
      'Image validation job encountered an error'
    );

    // If max retries reached, mark as permanently FAILED in PostgreSQL
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      try {
        await repository.updateValidationResult(imageId, {
          status: ImageStatus.FAILED,
          rejectionReasons: [`Processing failed after ${job.attemptsMade} attempts: ${err.message}`],
        });

        await repository.recordProcessingAttempt({
          imageId,
          attemptNumber: job.attemptsMade,
          status: 'FAILED',
          error: err.message,
        });

        sseManager.notifyImageStatus({
          imageId,
          status: ImageStatus.FAILED,
          rejectionReasons: [err.message],
          updatedAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        logger.error({ dbErr, imageId }, 'Failed to record failed job state in database');
      }
    }
  });

  return worker;
}

// Standalone worker runner if executed directly
if (process.env.NODE_ENV !== 'test') {
  const isWorkerProcess = process.argv[1]?.includes('image-processor.worker');
  if (isWorkerProcess) {
    logger.info('Starting standalone Image Processor Worker...');
    const worker = createImageProcessingWorker();

    const gracefulShutdown = async () => {
      logger.info('Shutting down Image Processor Worker...');
      await worker.close();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }
}
