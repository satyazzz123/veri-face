import sharp from 'sharp';
import {
  DetectedFormat,
  ImageValidationContext,
  ValidationResult,
  ValidationRule,
} from '@image-val/shared';
import { ImageValidator } from './validator.interface.js';

export class FormatValidator implements ImageValidator {
  readonly ruleName = ValidationRule.FORMAT;

  /**
   * Inspects buffer magic bytes (file signature) to detect format.
   * Does NOT trust MIME headers or file extensions.
   */
  public detectMagicBytes(buffer: Buffer): DetectedFormat {
    if (!buffer || buffer.length < 12) {
      return DetectedFormat.UNKNOWN;
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return DetectedFormat.JPEG;
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return DetectedFormat.PNG;
    }

    // HEIC / HEIF (ISOBMFF format: [4 bytes size][ftyp][4 bytes major brand])
    const ftypBox = buffer.subarray(4, 8).toString('ascii');
    if (ftypBox === 'ftyp') {
      const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
      const compatibleBrands = buffer.subarray(16, Math.min(buffer.length, 36)).toString('ascii').toLowerCase();

      const isHeic =
        ['heic', 'heix', 'heim', 'heis'].includes(brand) ||
        compatibleBrands.includes('heic') ||
        compatibleBrands.includes('heix');

      const isHeif =
        ['mif1', 'msf1', 'heif'].includes(brand) ||
        compatibleBrands.includes('mif1') ||
        compatibleBrands.includes('msf1');

      if (isHeic) return DetectedFormat.HEIC;
      if (isHeif) return DetectedFormat.HEIF;
    }

    return DetectedFormat.UNKNOWN;
  }

  public async validate(context: ImageValidationContext): Promise<ValidationResult> {
    const magicFormat = this.detectMagicBytes(context.originalBuffer);

    if (magicFormat === DetectedFormat.UNKNOWN) {
      return {
        rule: this.ruleName,
        passed: false,
        reason:
          'Invalid or unsupported image signature. Only JPEG, PNG, and HEIC/HEIF images are permitted.',
        metadata: { detectedSignature: 'UNKNOWN' },
      };
    }

    // If it's JPEG or PNG, verify that Sharp can decode the metadata to ensure it's not corrupt
    if (magicFormat === DetectedFormat.JPEG || magicFormat === DetectedFormat.PNG) {
      try {
        const metadata = await sharp(context.originalBuffer).metadata();
        if (!metadata.format || !metadata.width || !metadata.height) {
          return {
            rule: this.ruleName,
            passed: false,
            reason: 'Corrupted image file: unable to decode image headers or dimensions.',
            metadata: { detectedSignature: magicFormat },
          };
        }

        const normalizedFormat = metadata.format.toUpperCase();
        if (
          (magicFormat === DetectedFormat.JPEG && normalizedFormat !== 'JPEG') ||
          (magicFormat === DetectedFormat.PNG && normalizedFormat !== 'PNG')
        ) {
          return {
            rule: this.ruleName,
            passed: false,
            reason: `Image format mismatch: signature indicates ${magicFormat} but decoded payload is ${normalizedFormat}.`,
            metadata: { detectedSignature: magicFormat, decodedFormat: normalizedFormat },
          };
        }

        context.width = metadata.width;
        context.height = metadata.height;
        context.detectedFormat = magicFormat;
      } catch (err: unknown) {
        return {
          rule: this.ruleName,
          passed: false,
          reason: `Corrupt image payload: ${err instanceof Error ? err.message : 'Decoding failed'}`,
          metadata: { detectedSignature: magicFormat },
        };
      }
    } else {
      // HEIC / HEIF
      context.detectedFormat = magicFormat;
    }

    return {
      rule: this.ruleName,
      passed: true,
      metadata: { format: context.detectedFormat },
    };
  }
}
