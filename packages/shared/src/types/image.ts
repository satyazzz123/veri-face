export enum ImageStatus {
  SELECTED = 'SELECTED',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum DetectedFormat {
  JPEG = 'JPEG',
  PNG = 'PNG',
  HEIC = 'HEIC',
  HEIF = 'HEIF',
  UNKNOWN = 'UNKNOWN',
}

export enum ValidationRule {
  FORMAT = 'FORMAT',
  FILE_SIZE = 'FILE_SIZE',
  RESOLUTION = 'RESOLUTION',
  SIMILARITY = 'SIMILARITY',
  BLUR = 'BLUR',
  FACE = 'FACE',
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface ValidationResult {
  rule: ValidationRule | string;
  passed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageValidationContext {
  imageId: string;
  originalBuffer: Buffer;
  processedBuffer?: Buffer;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  detectedFormat?: DetectedFormat;
  perceptualHash?: string;
  blurScore?: number;
  faces?: FaceBoundingBox[];
  isAccepted?: boolean;
  rejectionReasons: string[];
  validationResults: ValidationResult[];
}

export interface ImageRecord {
  id: string;
  originalFilename: string;
  storedFilename: string;
  originalMimeType: string;
  detectedFormat: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  originalStorageKey: string;
  processedStorageKey: string | null;
  status: ImageStatus;
  rejectionReasons: string[];
  blurScore: number | null;
  faceCount: number | null;
  faceBoundingBoxes: FaceBoundingBox[] | null;
  perceptualHash: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  processedAt: Date | string | null;
  deletedAt: Date | string | null;
  signedOriginalUrl?: string | null;
  signedProcessedUrl?: string | null;
}

export interface ValidationResultRecord {
  id: string;
  imageId: string;
  rule: string;
  passed: boolean;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
}

export interface ProcessingAttemptRecord {
  id: string;
  imageId: string;
  attemptNumber: number;
  status: string;
  error: string | null;
  durationMs: number | null;
  createdAt: Date | string;
}

export interface SSEStatusUpdatePayload {
  imageId: string;
  status: ImageStatus;
  rejectionReasons?: string[];
  blurScore?: number | null;
  faceCount?: number | null;
  perceptualHash?: string | null;
  signedProcessedUrl?: string | null;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}
