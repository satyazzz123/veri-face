import sharp from 'sharp';
import {
  DEFAULT_LIMITS,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { ImageValidator } from '../validators/validator.interface.js';

export interface CandidateHashProvider {
  /**
   * Retrieves candidate perceptual hashes for similarity comparison.
   * Can implement sub-hash bucketing or recent candidate queries.
   */
  findCandidateHashes(hash: string, excludeImageId: string): Promise<Array<{ imageId: string; perceptualHash: string; filename: string }>>;
}

export class SimilarityDetector implements ImageValidator {
  readonly ruleName = ValidationRule.SIMILARITY;
  private readonly threshold: number;
  private readonly candidateProvider?: CandidateHashProvider;

  constructor(options?: { threshold?: number; candidateProvider?: CandidateHashProvider }) {
    this.threshold = options?.threshold ?? DEFAULT_LIMITS.SIMILARITY_THRESHOLD;
    this.candidateProvider = options?.candidateProvider;
  }

  /**
   * Computes a 64-bit perceptual hash (dHash - Difference Hash).
   * 1. Converts image to 9x8 grayscale buffer (72 pixels).
   * 2. For each row, compares adjacent pixels (pixel[x] > pixel[x+1] => 1 else 0).
   * 3. Produces a 64-bit binary representation encoded as a 16-character hex string.
   */
  public async computeDHash(imageBuffer: Buffer): Promise<string> {
    const rawPixels = await sharp(imageBuffer)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    let binaryStr = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const leftPixel = rawPixels[row * 9 + col];
        const rightPixel = rawPixels[row * 9 + col + 1];
        binaryStr += leftPixel > rightPixel ? '1' : '0';
      }
    }

    // Convert 64-bit binary string to 16-char hex string
    let hexStr = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
      const nibble = binaryStr.substring(i, i + 4);
      hexStr += parseInt(nibble, 2).toString(16);
    }

    return hexStr.padStart(16, '0');
  }

  /**
   * Computes a 64-bit DCT-based perceptual hash (pHash).
   * 1. Resizes to 32x32 grayscale.
   * 2. Performs 2D Discrete Cosine Transform.
   * 3. Extracts 8x8 low frequencies, calculates median, and constructs 64-bit hash.
   */
  public async computePHash(imageBuffer: Buffer): Promise<string> {
    const size = 32;
    const rawPixels = await sharp(imageBuffer)
      .resize(size, size, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    // 2D DCT on 32x32 matrix
    const matrix: number[][] = [];
    for (let y = 0; y < size; y++) {
      matrix[y] = [];
      for (let x = 0; x < size; x++) {
        matrix[y][x] = rawPixels[y * size + x];
      }
    }

    const dct: number[][] = [];
    const factor = Math.PI / (2 * size);

    for (let u = 0; u < 8; u++) {
      dct[u] = [];
      for (let v = 0; v < 8; v++) {
        let sum = 0;
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            sum += matrix[y][x] * Math.cos((2 * x + 1) * u * factor) * Math.cos((2 * y + 1) * v * factor);
          }
        }
        const cu = u === 0 ? 1 / Math.SQRT2 : 1;
        const cv = v === 0 ? 1 / Math.SQRT2 : 1;
        dct[u][v] = (1 / 4) * cu * cv * sum;
      }
    }

    // Compute median of 8x8 frequencies, excluding DC coefficient [0][0]
    const values: number[] = [];
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        if (u === 0 && v === 0) continue;
        values.push(dct[u][v]);
      }
    }

    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];

    let binaryStr = '';
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        binaryStr += dct[u][v] > median ? '1' : '0';
      }
    }

    let hexStr = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
      const nibble = binaryStr.substring(i, i + 4);
      hexStr += parseInt(nibble, 2).toString(16);
    }

    return hexStr.padStart(16, '0');
  }

  /**
   * Calculates the Hamming distance (number of differing bits) between two 64-bit hex hashes.
   */
  public calculateHammingDistance(hashA: string, hashB: string): number {
    try {
      let xor = BigInt('0x' + hashA) ^ BigInt('0x' + hashB);
      let distance = 0;
      while (xor > 0n) {
        if ((xor & 1n) === 1n) {
          distance++;
        }
        xor >>= 1n;
      }
      return distance;
    } catch {
      return 64; // Max distance on invalid hex input
    }
  }

  /**
   * Splits a 64-bit hash (16 hex chars) into 4 x 16-bit bucket tokens (4 hex chars each)
   * used for sub-hash candidate indexing.
   */
  public static getSubHashBuckets(hash: string): [string, string, string, string] {
    const clean = hash.padStart(16, '0');
    return [
      clean.substring(0, 4),
      clean.substring(4, 8),
      clean.substring(8, 12),
      clean.substring(12, 16),
    ];
  }

  public async validate(context: ImageValidationContext): Promise<ValidationResult> {
    const activeBuffer = context.processedBuffer ?? context.originalBuffer;

    if (!context.perceptualHash) {
      context.perceptualHash = await this.computePHash(activeBuffer);
    }

    if (!this.candidateProvider) {
      return {
        rule: this.ruleName,
        passed: true,
        metadata: { perceptualHash: context.perceptualHash, candidatesChecked: 0 },
      };
    }

    const candidates = await this.candidateProvider.findCandidateHashes(
      context.perceptualHash,
      context.imageId
    );

    for (const candidate of candidates) {
      const distance = this.calculateHammingDistance(context.perceptualHash, candidate.perceptualHash);
      if (distance <= this.threshold) {
        return {
          rule: this.ruleName,
          passed: false,
          reason: `Duplicate or near-duplicate image detected. Hamming distance is ${distance} (threshold is ${this.threshold}) compared to image "${candidate.filename}".`,
          metadata: {
            perceptualHash: context.perceptualHash,
            matchedImageId: candidate.imageId,
            matchedFilename: candidate.filename,
            hammingDistance: distance,
            threshold: this.threshold,
          },
        };
      }
    }

    return {
      rule: this.ruleName,
      passed: true,
      metadata: {
        perceptualHash: context.perceptualHash,
        candidatesChecked: candidates.length,
        threshold: this.threshold,
      },
    };
  }
}
