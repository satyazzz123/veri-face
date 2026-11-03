import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logger/logger.js';

export const IMAGE_VALIDATION_QUEUE_NAME = 'image-validation';

export interface ImageValidationJobData {
  imageId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

let redisConnection: IORedis.Redis | null = null;
let validationQueue: Queue<ImageValidationJobData> | null = null;

export function getRedisConnection(redisUrl?: string): IORedis.Redis {
  if (!redisConnection) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    redisConnection = new IORedis.Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    redisConnection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    redisConnection.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  return redisConnection;
}

export function getImageValidationQueue(redisUrl?: string): Queue<ImageValidationJobData> {
  if (!validationQueue) {
    const connection = getRedisConnection(redisUrl);
    const queueOptions: QueueOptions = {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600 * 24, // Keep completed jobs for 24h
          count: 500,
        },
        removeOnFail: {
          age: 3600 * 24 * 7, // Keep failed jobs for 7 days
        },
      },
    };

    validationQueue = new Queue<ImageValidationJobData>(
      IMAGE_VALIDATION_QUEUE_NAME,
      queueOptions
    );
  }

  return validationQueue;
}

export async function closeQueueConnections(): Promise<void> {
  if (validationQueue) {
    await validationQueue.close();
    validationQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
