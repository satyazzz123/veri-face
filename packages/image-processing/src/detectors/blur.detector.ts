import sharp from 'sharp';
import {
  DEFAULT_LIMITS,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { ImageValidator } from '../validators/validator.interface.js';

export class BlurDetector implements ImageValidator {
  readonly ruleName = ValidationRule.BLUR;
  private readonly threshold: number;

  constructor(options?: { threshold?: number }) {
    this.threshold = options?.threshold ?? DEFAULT_LIMITS.BLUR_THRESHOLD;
  }

  /**
   * Calculates the Laplacian variance (Brenner/Pech-Pacheco blur metric) on the image.
   * Equivalent to OpenCV's: cv2.Laplacian(image, cv2.CV_64F).var()
   *
   * 1. Converts image to 8-bit grayscale raw buffer.
   * 2. Convolves the image with the standard discrete Laplacian operator:
   *       [  0,  1,  0 ]
   *       [  1, -4,  1 ]
   *       [  0,  1,  0 ]
   * 3. Calculates the statistical variance of the response:
   *       Var = (1 / N) * sum((L[i,j] - mean)^2)
   */
  public async computeBlurScore(imageBuffer: Buffer): Promise<number> {
    // Resize down to at most 1024 on the longest side if very large to optimize performance while preserving edge response
    const metadata = await sharp(imageBuffer).metadata();
    const maxDim = 1024;
    let pipeline = sharp(imageBuffer).grayscale();

    if (metadata.width && metadata.height && (metadata.width > maxDim || metadata.height > maxDim)) {
      pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside' });
    }

    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    if (width < 3 || height < 3) {
      return 0;
    }

    // Allocate array for Laplacian responses
    const count = (width - 2) * (height - 2);
    let sum = 0;

    // First pass: Compute Laplacian convolution and mean
    const responses = new Float64Array(count);
    let idx = 0;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      const prevRowOffset = (y - 1) * width;
      const nextRowOffset = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        // Standard discrete 4-neighborhood Laplacian kernel
        const center = data[rowOffset + x];
        const up = data[prevRowOffset + x];
        const down = data[nextRowOffset + x];
        const left = data[rowOffset + x - 1];
        const right = data[rowOffset + x + 1];

        const laplacian = up + down + left + right - 4 * center;
        responses[idx++] = laplacian;
        sum += laplacian;
      }
    }

    const mean = sum / count;

    // Second pass: Calculate variance
    let sumSquaredDiff = 0;
    for (let i = 0; i < count; i++) {
      const diff = responses[i] - mean;
      sumSquaredDiff += diff * diff;
    }

    const variance = sumSquaredDiff / count;
    return Math.round(variance * 100) / 100;
  }

  public async validate(context: ImageValidationContext): Promise<ValidationResult> {
    const activeBuffer = context.processedBuffer ?? context.originalBuffer;
    const blurScore = await this.computeBlurScore(activeBuffer);
    context.blurScore = blurScore;

    if (blurScore < this.threshold) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `Image is too blurry. Blur score is ${blurScore} (minimum acceptable threshold is ${this.threshold}).`,
        metadata: { blurScore, threshold: this.threshold },
      };
    }

    return {
      rule: this.ruleName,
      passed: true,
      metadata: { blurScore, threshold: this.threshold },
    };
  }
}
