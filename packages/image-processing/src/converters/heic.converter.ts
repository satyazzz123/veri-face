import sharp from 'sharp';
import convert from 'heic-convert';

export interface HeicConversionResult {
  convertedBuffer: Buffer;
  format: 'JPEG';
  width: number;
  height: number;
}

export class HeicConverter {
  /**
   * Verifies whether an active HEIC decoder is available in this runtime environment.
   */
  public static isDecoderAvailable(): boolean {
    // heic-convert uses libheif-js compiled to WebAssembly / pure JS,
    // which is unconditionally available across all Node.js platforms.
    try {
      return typeof convert === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Converts a HEIC or HEIF buffer to standard high-quality JPEG.
   * Auto-rotates using EXIF orientation and preserves aspect ratio.
   */
  public async convertToJpeg(inputBuffer: Buffer, quality: number = 92): Promise<HeicConversionResult> {
    if (!HeicConverter.isDecoderAvailable()) {
      throw new Error(
        'HEIC decoder is not available. Please ensure "heic-convert" and WASM runtime dependencies are installed.'
      );
    }

    try {
      // Decode HEIC/HEIF to raw JPEG buffer using heic-convert
      const rawJpeg = await convert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: quality / 100,
      });

      const intermediateBuffer = Buffer.from(rawJpeg);

      // Pass through sharp to normalize orientation (auto-orient EXIF), strip metadata if necessary, and extract final dimensions
      const processed = await sharp(intermediateBuffer)
        .rotate() // auto-orient based on EXIF
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      return {
        convertedBuffer: processed.data,
        format: 'JPEG',
        width: processed.info.width,
        height: processed.info.height,
      };
    } catch (err: unknown) {
      throw new Error(
        `Failed to decode and convert HEIC image: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
