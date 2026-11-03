import dotenv from 'dotenv';
import path from 'path';
import { AppEnv, validateEnv } from '@image-val/shared';

// Load root .env file
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
// Also fallback to local .env if present
dotenv.config();

let cachedEnv: AppEnv | null = null;

export function getEnvMockDefaults(): AppEnv {
  return {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'test-access',
    S3_SECRET_KEY: 'test-secret',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'us-east-1',
    S3_FORCE_PATH_STYLE: true,
    NODE_ENV: 'test',
    PORT: 4000,
    WEB_URL: 'http://localhost:3000',
    MAX_FILE_SIZE_MB: 10,
    MAX_FILES_PER_REQUEST: 10,
    MIN_IMAGE_WIDTH: 512,
    MIN_IMAGE_HEIGHT: 512,
    MIN_IMAGE_SIZE_BYTES: 10240,
    MAX_IMAGE_PIXELS: 40000000,
    BLUR_THRESHOLD: 100,
    FACE_MIN_AREA_RATIO: 0.05,
    SIMILARITY_THRESHOLD: 8,
    WORKER_CONCURRENCY: 3,
    UPLOAD_DIR: './tmp/uploads',
  };
}

export function getEnv(): AppEnv {
  if (process.env.NODE_ENV === 'test') {
    return getEnvMockDefaults();
  }
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}
