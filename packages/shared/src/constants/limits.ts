export const DEFAULT_LIMITS = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_FILES_PER_REQUEST: 10,
  MIN_IMAGE_WIDTH: 512,
  MIN_IMAGE_HEIGHT: 512,
  MIN_IMAGE_SIZE_BYTES: 10240, // 10 KB
  MAX_IMAGE_PIXELS: 40_000_000, // 40 MP decompression bomb defense
  BLUR_THRESHOLD: 100, // Laplacian variance threshold
  FACE_MIN_AREA_RATIO: 0.05, // Minimum face area ratio relative to image area
  SIMILARITY_THRESHOLD: 8, // Hamming distance threshold for 64-bit perceptual hash
  WORKER_CONCURRENCY: 3,
} as const;

export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

export const SUPPORTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
] as const;
