import { describe, it, expect } from 'vitest';
import {
  FormatValidator,
  FileSizeValidator,
  ResolutionValidator,
  BlurDetector,
  SimilarityDetector,
  ValidationPipeline,
} from '../src/index.js';
import {
  createValidJpeg,
  createValidPng,
  createSharpImage,
  createBlurredImage,
  createDisguisedTextFile,
  createCorruptedJpeg,
  createSyntheticFaceImage,
} from './fixtures.js';
import { DetectedFormat, ImageValidationContext } from '@image-val/shared';

describe('Image Validation Engine Unit & Algorithmic Tests', () => {
  describe('FormatValidator', () => {
    const validator = new FormatValidator();

    it('should successfully detect and validate a real JPEG image signature', async () => {
      const buffer = await createValidJpeg(600, 600);
      const context: ImageValidationContext = {
        imageId: 'test-1',
        originalBuffer: buffer,
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(true);
      expect(context.detectedFormat).toBe(DetectedFormat.JPEG);
      expect(context.width).toBe(600);
      expect(context.height).toBe(600);
    });

    it('should successfully detect and validate a real PNG image signature', async () => {
      const buffer = await createValidPng(600, 600);
      const context: ImageValidationContext = {
        imageId: 'test-2',
        originalBuffer: buffer,
        originalFilename: 'test.png',
        mimeType: 'image/png',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(true);
      expect(context.detectedFormat).toBe(DetectedFormat.PNG);
    });

    it('should reject a disguised text file claiming to be a JPEG', async () => {
      const buffer = createDisguisedTextFile();
      const context: ImageValidationContext = {
        imageId: 'test-3',
        originalBuffer: buffer,
        originalFilename: 'fake.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Invalid or unsupported image signature');
    });

    it('should reject a corrupted JPEG binary', async () => {
      const buffer = createCorruptedJpeg();
      const context: ImageValidationContext = {
        imageId: 'test-4',
        originalBuffer: buffer,
        originalFilename: 'corrupt.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Corrupt');
    });
  });

  describe('FileSizeValidator', () => {
    const validator = new FileSizeValidator({
      minSizeBytes: 1024,
      maxSizeBytes: 50 * 1024,
    });

    it('should accept an image within acceptable size bounds', async () => {
      const buffer = Buffer.alloc(10 * 1024);
      const context: ImageValidationContext = {
        imageId: 'test-5',
        originalBuffer: buffer,
        originalFilename: 'sized.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(true);
    });

    it('should reject an image smaller than minimum file size', async () => {
      const buffer = Buffer.alloc(500); // 500 bytes < 1024 bytes
      const context: ImageValidationContext = {
        imageId: 'test-6',
        originalBuffer: buffer,
        originalFilename: 'tiny.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('File size too small');
    });

    it('should reject an image larger than maximum file size', async () => {
      const buffer = Buffer.alloc(60 * 1024); // 60 KB > 50 KB
      const context: ImageValidationContext = {
        imageId: 'test-7',
        originalBuffer: buffer,
        originalFilename: 'huge.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('File size exceeds limit');
    });
  });

  describe('ResolutionValidator', () => {
    const validator = new ResolutionValidator({
      minWidth: 512,
      minHeight: 512,
      maxPixels: 40_000_000,
    });

    it('should pass an image with 600x600 resolution', async () => {
      const buffer = await createValidJpeg(600, 600);
      const context: ImageValidationContext = {
        imageId: 'test-8',
        originalBuffer: buffer,
        originalFilename: 'res.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        width: 600,
        height: 600,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(true);
    });

    it('should reject an image with resolution below 512x512', async () => {
      const buffer = await createValidJpeg(300, 300);
      const context: ImageValidationContext = {
        imageId: 'test-9',
        originalBuffer: buffer,
        originalFilename: 'small.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        width: 300,
        height: 300,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('below required minimum resolution');
    });

    it('should reject an image that violates the maximum pixel decompression threshold', async () => {
      const context: ImageValidationContext = {
        imageId: 'test-10',
        originalBuffer: Buffer.alloc(100),
        originalFilename: 'bomb.jpg',
        mimeType: 'image/jpeg',
        fileSize: 100,
        width: 10000,
        height: 5000, // 50,000,000 pixels > 40,000,000
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await validator.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('decompression safety limit');
    });
  });

  describe('BlurDetector (Laplacian Variance)', () => {
    const detector = new BlurDetector({ threshold: 100 });

    it('should detect high Laplacian variance on a sharp checkerboard pattern', async () => {
      const sharpBuffer = await createSharpImage(600, 600);
      const score = await detector.computeBlurScore(sharpBuffer);

      expect(score).toBeGreaterThan(100);

      const context: ImageValidationContext = {
        imageId: 'test-11',
        originalBuffer: sharpBuffer,
        originalFilename: 'sharp.jpg',
        mimeType: 'image/jpeg',
        fileSize: sharpBuffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await detector.validate(context);
      expect(result.passed).toBe(true);
      expect(result.metadata?.blurScore).toBeGreaterThan(100);
    });

    it('should reject an image with heavy Gaussian blur (low Laplacian variance)', async () => {
      const blurredBuffer = await createBlurredImage(600, 600);
      const score = await detector.computeBlurScore(blurredBuffer);

      expect(score).toBeLessThan(100);

      const context: ImageValidationContext = {
        imageId: 'test-12',
        originalBuffer: blurredBuffer,
        originalFilename: 'blur.jpg',
        mimeType: 'image/jpeg',
        fileSize: blurredBuffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await detector.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Image is too blurry');
    });
  });

  describe('SimilarityDetector (Perceptual Hashing & Hamming Distance)', () => {
    const detector = new SimilarityDetector({ threshold: 8 });

    it('should compute deterministic 64-bit perceptual hashes', async () => {
      const buffer = await createValidJpeg(600, 600);
      const hash1 = await detector.computePHash(buffer);
      const hash2 = await detector.computePHash(buffer);

      expect(hash1).toHaveLength(16); // 16 hex characters = 64 bits
      expect(hash1).toBe(hash2);

      const dHash = await detector.computeDHash(buffer);
      expect(dHash).toHaveLength(16);
    });

    it('should calculate 0 Hamming distance for identical hashes', () => {
      const hash = 'a1b2c3d4e5f67890';
      const distance = detector.calculateHammingDistance(hash, hash);
      expect(distance).toBe(0);
    });

    it('should detect near-duplicate images with Hamming distance <= threshold', async () => {
      const mockCandidateProvider = {
        findCandidateHashes: async () => [
          {
            imageId: 'existing-img-1',
            perceptualHash: 'ffff0000ffff0000',
            filename: 'original.jpg',
          },
        ],
      };

      const detectorWithProvider = new SimilarityDetector({
        threshold: 8,
        candidateProvider: mockCandidateProvider,
      });

      // Difference of 2 bits from 'ffff0000ffff0000'
      const context: ImageValidationContext = {
        imageId: 'test-13',
        originalBuffer: Buffer.alloc(10),
        originalFilename: 'near-duplicate.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10,
        perceptualHash: 'ffff0000ffff0003', // 2 bits diff (0b0011)
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await detectorWithProvider.validate(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Duplicate or near-duplicate image detected');
      expect(result.metadata?.hammingDistance).toBe(2);
    });

    it('should accept distinct images with Hamming distance > threshold', async () => {
      const mockCandidateProvider = {
        findCandidateHashes: async () => [
          {
            imageId: 'existing-img-1',
            perceptualHash: 'ffffffff00000000',
            filename: 'distinct.jpg',
          },
        ],
      };

      const detectorWithProvider = new SimilarityDetector({
        threshold: 8,
        candidateProvider: mockCandidateProvider,
      });

      const context: ImageValidationContext = {
        imageId: 'test-14',
        originalBuffer: Buffer.alloc(10),
        originalFilename: 'unique.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10,
        perceptualHash: '00000000ffffffff', // 64 bits diff
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await detectorWithProvider.validate(context);
      expect(result.passed).toBe(true);
    });
  });

  describe('ValidationPipeline Orchestration', () => {
    it('should execute full pipeline and return structured result', async () => {
      const buffer = await createSharpImage(600, 600);
      const pipeline = new ValidationPipeline({
        fileSize: { minSizeBytes: 100, maxSizeBytes: 10 * 1024 * 1024 },
        resolution: { minWidth: 512, minHeight: 512 },
        blur: { threshold: 50 },
      });

      const context: ImageValidationContext = {
        imageId: 'test-pipeline-1',
        originalBuffer: buffer,
        originalFilename: 'sharp-photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await pipeline.execute(context);
      expect(result.imageId).toBe('test-pipeline-1');
      expect(result.detectedFormat).toBe(DetectedFormat.JPEG);
      expect(result.width).toBe(600);
      expect(result.height).toBe(600);
      expect(result.validationResults.length).toBeGreaterThan(0);
    });

    it('should terminate early on invalid magic bytes before running expensive blur/face checks', async () => {
      const buffer = createDisguisedTextFile();
      const pipeline = new ValidationPipeline();

      const context: ImageValidationContext = {
        imageId: 'test-pipeline-early-exit',
        originalBuffer: buffer,
        originalFilename: 'fake.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        rejectionReasons: [],
        validationResults: [],
      };

      const result = await pipeline.execute(context);
      expect(result.isAccepted).toBe(false);
      expect(result.rejectionReasons[0]).toContain('Invalid or unsupported image signature');
      // Only format rule was executed
      expect(result.validationResults).toHaveLength(1);
    });
  });
});
