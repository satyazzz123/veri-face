import sharp from 'sharp';
import {
  DEFAULT_LIMITS,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { ImageValidator } from './validator.interface.js';

export interface ResolutionValidatorOptions {
  minWidth?: number;
  minHeight?: number;
  maxPixels?: number;
}

export class ResolutionValidator implements ImageValidator {
  readonly ruleName = ValidationRule.RESOLUTION;
  private readonly minWidth: number;
  private readonly minHeight: number;
  private readonly maxPixels: number;

  constructor(options?: ResolutionValidatorOptions) {
    this.minWidth = options?.minWidth ?? DEFAULT_LIMITS.MIN_IMAGE_WIDTH;
    this.minHeight = options?.minHeight ?? DEFAULT_LIMITS.MIN_IMAGE_HEIGHT;
    this.maxPixels = options?.maxPixels ?? DEFAULT_LIMITS.MAX_IMAGE_PIXELS;
  }

  public async validate(context: ImageValidationContext): Promise<ValidationResult> {
    const activeBuffer = context.processedBuffer ?? context.originalBuffer;

    let width = context.width;
    let height = context.height;

    if (!width || !height) {
      try {
        const metadata = await sharp(activeBuffer).metadata();
        width = metadata.width;
        height = metadata.height;
        context.width = width;
        context.height = height;
      } catch (err: unknown) {
        return {
          rule: this.ruleName,
          passed: false,
          reason: `Failed to inspect image dimensions: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    }

    if (!width || !height) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: 'Unable to retrieve image width and height dimensions.',
      };
    }

    const totalPixels = width * height;

    // Decompression bomb / pixel flood protection
    if (totalPixels > this.maxPixels) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `Image pixel count (${totalPixels.toLocaleString()} px) exceeds decompression safety limit of ${this.maxPixels.toLocaleString()} pixels.`,
        metadata: { width, height, totalPixels, maxPixels: this.maxPixels },
      };
    }

    if (width < this.minWidth || height < this.minHeight) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `Image dimensions (${width}x${height}px) below required minimum resolution of ${this.minWidth}x${this.minHeight}px.`,
        metadata: { width, height, minWidth: this.minWidth, minHeight: this.minHeight },
      };
    }

    return {
      rule: this.ruleName,
      passed: true,
      metadata: { width, height, totalPixels },
    };
  }
}
