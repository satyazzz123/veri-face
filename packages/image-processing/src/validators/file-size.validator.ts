import {
  DEFAULT_LIMITS,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { ImageValidator } from './validator.interface.js';

export interface FileSizeValidatorOptions {
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

export class FileSizeValidator implements ImageValidator {
  readonly ruleName = ValidationRule.FILE_SIZE;
  private readonly minSizeBytes: number;
  private readonly maxSizeBytes: number;

  constructor(options?: FileSizeValidatorOptions) {
    this.minSizeBytes = options?.minSizeBytes ?? DEFAULT_LIMITS.MIN_IMAGE_SIZE_BYTES;
    this.maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_LIMITS.MAX_FILE_SIZE_BYTES;
  }

  public async validate(context: ImageValidationContext): Promise<ValidationResult> {
    const size = context.fileSize || context.originalBuffer.length;

    if (size < this.minSizeBytes) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `File size too small (${(size / 1024).toFixed(1)} KB). Minimum allowed size is ${(this.minSizeBytes / 1024).toFixed(1)} KB.`,
        metadata: { fileSize: size, minSizeBytes: this.minSizeBytes },
      };
    }

    if (size > this.maxSizeBytes) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `File size exceeds limit (${(size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is ${(this.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB.`,
        metadata: { fileSize: size, maxSizeBytes: this.maxSizeBytes },
      };
    }

    return {
      rule: this.ruleName,
      passed: true,
      metadata: { fileSize: size },
    };
  }
}
