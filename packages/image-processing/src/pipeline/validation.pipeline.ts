import {
  DetectedFormat,
  FaceBoundingBox,
  ImageStatus,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { FormatValidator } from '../validators/format.validator.js';
import { FileSizeValidator, FileSizeValidatorOptions } from '../validators/file-size.validator.js';
import { ResolutionValidator, ResolutionValidatorOptions } from '../validators/resolution.validator.js';
import { HeicConverter } from '../converters/heic.converter.js';
import { SimilarityDetector, CandidateHashProvider } from '../detectors/similarity.detector.js';
import { BlurDetector } from '../detectors/blur.detector.js';
import { FaceDetector, FaceDetectorOptions } from '../detectors/face.detector.js';

export interface PipelineOptions {
  fileSize?: FileSizeValidatorOptions;
  resolution?: ResolutionValidatorOptions;
  similarity?: { threshold?: number; candidateProvider?: CandidateHashProvider };
  blur?: { threshold?: number };
  face?: FaceDetectorOptions;
}

export interface PipelineExecutionResult {
  imageId: string;
  isAccepted: boolean;
  status: ImageStatus.ACCEPTED | ImageStatus.REJECTED;
  rejectionReasons: string[];
  validationResults: ValidationResult[];
  detectedFormat: DetectedFormat;
  originalBuffer: Buffer;
  processedBuffer?: Buffer;
  width?: number;
  height?: number;
  fileSize: number;
  perceptualHash?: string;
  blurScore?: number;
  faceCount?: number;
  faces?: FaceBoundingBox[];
}

export class ValidationPipeline {
  private readonly formatValidator: FormatValidator;
  private readonly fileSizeValidator: FileSizeValidator;
  private readonly resolutionValidator: ResolutionValidator;
  private readonly heicConverter: HeicConverter;
  private readonly similarityDetector: SimilarityDetector;
  private readonly blurDetector: BlurDetector;
  private readonly faceDetector: FaceDetector;

  constructor(options?: PipelineOptions) {
    this.formatValidator = new FormatValidator();
    this.fileSizeValidator = new FileSizeValidator(options?.fileSize);
    this.resolutionValidator = new ResolutionValidator(options?.resolution);
    this.heicConverter = new HeicConverter();
    this.similarityDetector = new SimilarityDetector(options?.similarity);
    this.blurDetector = new BlurDetector(options?.blur);
    this.faceDetector = new FaceDetector(options?.face);
  }

  /**
   * Executes the full 15-step validation sequence.
   * Exits early on critical structural errors (decompression bombs, corrupt payloads).
   */
  public async execute(context: ImageValidationContext): Promise<PipelineExecutionResult> {
    const rejectionReasons: string[] = [];
    const validationResults: ValidationResult[] = [];

    // Helper to record result
    const record = (result: ValidationResult): boolean => {
      validationResults.push(result);
      if (!result.passed && result.reason) {
        rejectionReasons.push(result.reason);
        return false;
      }
      return true;
    };

    // Step 1, 2 & 3: Load, verify integrity, and detect format from magic bytes & headers
    const formatResult = await this.formatValidator.validate(context);
    if (!record(formatResult)) {
      // Immediate termination on corrupt/unsupported binary
      return this.finalize(context, rejectionReasons, validationResults);
    }

    // Step 4: Convert HEIC/HEIF if necessary
    if (context.detectedFormat === DetectedFormat.HEIC || context.detectedFormat === DetectedFormat.HEIF) {
      try {
        const conversion = await this.heicConverter.convertToJpeg(context.originalBuffer);
        context.processedBuffer = conversion.convertedBuffer;
        context.width = conversion.width;
        context.height = conversion.height;
      } catch (err: unknown) {
        record({
          rule: ValidationRule.FORMAT,
          passed: false,
          reason: `HEIC conversion failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        return this.finalize(context, rejectionReasons, validationResults);
      }
    }

    // Step 5: Validate file size (min & max limits)
    const sizeResult = await this.fileSizeValidator.validate(context);
    record(sizeResult);

    // Step 6: Validate dimensions (min width/height) & max pixel count (decompression bomb protection)
    const resResult = await this.resolutionValidator.validate(context);
    if (!record(resResult)) {
      // Immediate termination if decompression bomb or invalid dimensions
      return this.finalize(context, rejectionReasons, validationResults);
    }

    // Step 7 & 8: Compute perceptual hash & check similarity against candidates
    try {
      const simResult = await this.similarityDetector.validate(context);
      record(simResult);
    } catch (err: unknown) {
      record({
        rule: ValidationRule.SIMILARITY,
        passed: false,
        reason: `Similarity evaluation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Step 9: Compute blur score via Laplacian variance
    try {
      const blurResult = await this.blurDetector.validate(context);
      record(blurResult);
    } catch (err: unknown) {
      record({
        rule: ValidationRule.BLUR,
        passed: false,
        reason: `Blur analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Step 10, 11 & 12: Detect faces, evaluate face count (must equal 1), and evaluate face area ratio
    try {
      const faceResult = await this.faceDetector.validate(context);
      record(faceResult);
    } catch (err: unknown) {
      record({
        rule: ValidationRule.FACE,
        passed: false,
        reason: `Face detector failure: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Step 13, 14 & 15: Produce final decision
    return this.finalize(context, rejectionReasons, validationResults);
  }

  private finalize(
    context: ImageValidationContext,
    rejectionReasons: string[],
    validationResults: ValidationResult[]
  ): PipelineExecutionResult {
    const isAccepted = rejectionReasons.length === 0;
    const status = isAccepted ? ImageStatus.ACCEPTED : ImageStatus.REJECTED;

    context.isAccepted = isAccepted;
    context.rejectionReasons = rejectionReasons;
    context.validationResults = validationResults;

    return {
      imageId: context.imageId,
      isAccepted,
      status,
      rejectionReasons,
      validationResults,
      detectedFormat: context.detectedFormat ?? DetectedFormat.UNKNOWN,
      originalBuffer: context.originalBuffer,
      processedBuffer: context.processedBuffer,
      width: context.width,
      height: context.height,
      fileSize: context.fileSize,
      perceptualHash: context.perceptualHash,
      blurScore: context.blurScore,
      faceCount: context.faces ? context.faces.length : undefined,
      faces: context.faces,
    };
  }
}
