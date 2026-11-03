import { z } from 'zod';

export const EnvSchema = z.object({
  // Infrastructure Credentials
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (e.g. postgresql://user:pass@localhost:5432/dbname)'),
  REDIS_URL: z
    .string()
    .min(1, 'REDIS_URL is required (e.g. redis://localhost:6379)'),
  S3_ENDPOINT: z
    .string()
    .min(1, 'S3_ENDPOINT is required (e.g. http://localhost:9000 for MinIO or https://s3.amazonaws.com)'),
  S3_ACCESS_KEY: z
    .string()
    .min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z
    .string()
    .min(1, 'S3_SECRET_KEY is required'),
  S3_BUCKET: z
    .string()
    .min(1, 'S3_BUCKET is required (e.g. image-uploads)'),
  S3_REGION: z
    .string()
    .default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('true'),

  // Application Settings
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('4000'),
  WEB_URL: z
    .string()
    .url('WEB_URL must be a valid URL (e.g. http://localhost:3000)')
    .default('http://localhost:3000'),

  // Upload Restrictions
  MAX_FILE_SIZE_MB: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10'),
  MAX_FILES_PER_REQUEST: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10'),

  // Image Dimensions & Pixels
  MIN_IMAGE_WIDTH: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('512'),
  MIN_IMAGE_HEIGHT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('512'),
  MIN_IMAGE_SIZE_BYTES: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10240'),
  MAX_IMAGE_PIXELS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('40000000'),

  // Validation Thresholds
  BLUR_THRESHOLD: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive())
    .default('100'),
  FACE_MIN_AREA_RATIO: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .default('0.05'),
  SIMILARITY_THRESHOLD: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0))
    .default('8'),

  // Worker Settings
  WORKER_CONCURRENCY: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('3'),

  // Temporary Directory
  UPLOAD_DIR: z
    .string()
    .default('./tmp/uploads'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * Validates process.env against EnvSchema.
 * Throws a clean, readable error summary if any required variable is missing or invalid.
 */
export function validateEnv(rawEnv: Record<string, string | undefined> = process.env): AppEnv {
  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Configuration Error: Missing or invalid environment variables.\n` +
      `Please check your .env file:\n${formattedErrors}\n`
    );
  }
  return result.data;
}
