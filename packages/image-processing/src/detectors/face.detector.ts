import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import {
  DEFAULT_LIMITS,
  FaceBoundingBox,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { ImageValidator } from '../validators/validator.interface.js';

export interface FaceDetectorOptions {
  modelPath?: string;
  minAreaRatio?: number;
  confThreshold?: number;
  nmsThreshold?: number;
}

export class FaceDetector implements ImageValidator {
  readonly ruleName = ValidationRule.FACE;
  private readonly modelPath: string;
  private readonly minAreaRatio: number;
  private readonly confThreshold: number;
  private readonly nmsThreshold: number;
  private session: ort.InferenceSession | null = null;
  private isModelAvailable: boolean = false;

  constructor(options?: FaceDetectorOptions) {
    this.minAreaRatio = options?.minAreaRatio ?? DEFAULT_LIMITS.FACE_MIN_AREA_RATIO;
    this.confThreshold = options?.confThreshold ?? 0.6;
    this.nmsThreshold = options?.nmsThreshold ?? 0.3;

    // Default to the bundled OpenCV YuNet ONNX model
    this.modelPath =
      options?.modelPath ||
      path.resolve(process.cwd(), 'packages/image-processing/models/face_detection_yunet_2023mar.onnx');

    if (!fs.existsSync(this.modelPath)) {
      // Also check relative to package root if running inside api or worker
      const altPath = path.resolve(
        __dirname,
        '../../models/face_detection_yunet_2023mar.onnx'
      );
      if (fs.existsSync(altPath)) {
        this.modelPath = altPath;
      }
    }
  }

  /**
   * Lazy initializes the ONNX inference session.
   */
  private async getSession(): Promise<ort.InferenceSession | null> {
    if (this.session) return this.session;

    if (!fs.existsSync(this.modelPath)) {
      this.isModelAvailable = false;
      return null;
    }

    try {
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'],
      });
      this.isModelAvailable = true;
      return this.session;
    } catch (err) {
      this.isModelAvailable = false;
      return null;
    }
  }

  /**
   * Preprocesses image buffer to BGR float32 tensor of shape [1, 3, padH, padW].
   * YuNet requires dimensions divisible by 32.
   */
  private async preprocessImage(
    imageBuffer: Buffer,
    targetWidth = 320,
    targetHeight = 320
  ): Promise<{
    tensor: ort.Tensor;
    padW: number;
    padH: number;
    origWidth: number;
    origHeight: number;
  }> {
    const metadata = await sharp(imageBuffer).metadata();
    const origWidth = metadata.width || targetWidth;
    const origHeight = metadata.height || targetHeight;

    // Pad dimensions to multiples of 32
    const padW = Math.ceil(targetWidth / 32) * 32;
    const padH = Math.ceil(targetHeight / 32) * 32;

    // Extract raw RGB pixels resized to [padW, padH]
    const { data } = await sharp(imageBuffer)
      .resize(padW, padH, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert RGB to BGR planar float32 [1, 3, padH, padW]
    const pixelCount = padW * padH;
    const floatArray = new Float32Array(3 * pixelCount);

    const bOffset = 0;
    const gOffset = pixelCount;
    const rOffset = 2 * pixelCount;

    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 3 + 0];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];

      floatArray[bOffset + i] = b;
      floatArray[gOffset + i] = g;
      floatArray[rOffset + i] = r;
    }

    const tensor = new ort.Tensor('float32', floatArray, [1, 3, padH, padW]);
    return { tensor, padW, padH, origWidth, origHeight };
  }

  /**
   * Computes Intersection over Union (IoU) of two boxes.
   */
  private computeIoU(boxA: FaceBoundingBox, boxB: FaceBoundingBox): number {
    const xA = Math.max(boxA.x, boxB.x);
    const yA = Math.max(boxA.y, boxB.y);
    const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
    const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = boxA.width * boxA.height;
    const boxBArea = boxB.width * boxB.height;
    const unionArea = boxAArea + boxBArea - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  /**
   * Performs Non-Maximum Suppression to filter duplicate candidate boxes.
   */
  private applyNMS(boxes: FaceBoundingBox[], nmsThreshold: number): FaceBoundingBox[] {
    boxes.sort((a, b) => b.confidence - a.confidence);
    const selected: FaceBoundingBox[] = [];

    for (const box of boxes) {
      let keep = true;
      for (const existing of selected) {
        if (this.computeIoU(box, existing) > nmsThreshold) {
          keep = false;
          break;
        }
      }
      if (keep) {
        selected.push(box);
      }
    }

    return selected;
  }

  /**
   * Detects faces using OpenCV YuNet ONNX model.
   * Decodes feature pyramids at strides [8, 16, 32].
   */
  public async detectFaces(imageBuffer: Buffer): Promise<FaceBoundingBox[]> {
    const session = await this.getSession();
    if (!session) {
      return [];
    }

    const { tensor, padW, padH, origWidth, origHeight } = await this.preprocessImage(imageBuffer);
    const results = await session.run({ input: tensor });

    const strides = [8, 16, 32];
    const candidateBoxes: FaceBoundingBox[] = [];

    const scaleX = origWidth / padW;
    const scaleY = origHeight / padH;

    for (let i = 0; i < strides.length; i++) {
      const stride = strides[i];
      const cols = Math.floor(padW / stride);
      const rows = Math.floor(padH / stride);

      const clsTensor = results[`cls_${stride}`];
      const objTensor = results[`obj_${stride}`];
      const bboxTensor = results[`bbox_${stride}`];

      if (!clsTensor || !objTensor || !bboxTensor) continue;

      const clsData = clsTensor.data as Float32Array;
      const objData = objTensor.data as Float32Array;
      const bboxData = bboxTensor.data as Float32Array;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const clsScore = Math.max(0, Math.min(1, clsData[idx] ?? 0));
          const objScore = Math.max(0, Math.min(1, objData[idx] ?? 0));
          const score = Math.sqrt(clsScore * objScore);

          if (score >= this.confThreshold) {
            const dx = bboxData[idx * 4 + 0] ?? 0;
            const dy = bboxData[idx * 4 + 1] ?? 0;
            const dw = bboxData[idx * 4 + 2] ?? 0;
            const dh = bboxData[idx * 4 + 3] ?? 0;

            const cx = (c + dx) * stride;
            const cy = (r + dy) * stride;
            const w = Math.exp(dw) * stride;
            const h = Math.exp(dh) * stride;

            const x = Math.max(0, (cx - w / 2) * scaleX);
            const y = Math.max(0, (cy - h / 2) * scaleY);
            const width = Math.min(origWidth - x, w * scaleX);
            const height = Math.min(origHeight - y, h * scaleY);

            candidateBoxes.push({
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height),
              confidence: Math.round(score * 100) / 100,
            });
          }
        }
      }
    }

    return this.applyNMS(candidateBoxes, this.nmsThreshold);
  }

  public async validate(context: ImageValidationContext): Promise<ValidationResult> {
    const activeBuffer = context.processedBuffer ?? context.originalBuffer;
    const session = await this.getSession();

    if (!session) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `Face detector model could not be loaded from ${this.modelPath}. Ensure model file exists.`,
      };
    }

    const faces = await this.detectFaces(activeBuffer);
    context.faces = faces;

    const faceCount = faces.length;
    const imageWidth = context.width || 1;
    const imageHeight = context.height || 1;
    const imageArea = imageWidth * imageHeight;

    if (faceCount === 0) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: 'No face detected in image. The image must contain exactly one clearly visible face.',
        metadata: { faceCount: 0 },
      };
    }

    if (faceCount > 1) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `Multiple faces detected (${faceCount} faces found). The image must contain exactly one face.`,
        metadata: { faceCount, faces },
      };
    }

    // Exactly 1 face detected: evaluate face area ratio
    const primaryFace = faces[0];
    const faceArea = primaryFace.width * primaryFace.height;
    const areaRatio = imageArea > 0 ? faceArea / imageArea : 0;
    const roundedRatio = Math.round(areaRatio * 1000) / 1000;

    if (areaRatio < this.minAreaRatio) {
      return {
        rule: this.ruleName,
        passed: false,
        reason: `Face area is too small (${(areaRatio * 100).toFixed(1)}% of total image). Minimum required face area ratio is ${(this.minAreaRatio * 100).toFixed(1)}%.`,
        metadata: {
          faceCount: 1,
          face: primaryFace,
          areaRatio: roundedRatio,
          minAreaRatio: this.minAreaRatio,
        },
      };
    }

    return {
      rule: this.ruleName,
      passed: true,
      metadata: {
        faceCount: 1,
        face: primaryFace,
        areaRatio: roundedRatio,
      },
    };
  }
}
