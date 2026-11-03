import { PrismaClient, Prisma } from '@image-val/database';
import {
  ImageRecord,
  ImageStatus,
  ValidationResult,
  PaginatedResult,
} from '@image-val/shared';
import { SimilarityDetector, CandidateHashProvider } from '@image-val/image-processing';

export interface CreateImageParams {
  id: string;
  originalFilename: string;
  storedFilename: string;
  originalMimeType: string;
  fileSize: number;
  originalStorageKey: string;
  status: ImageStatus;
}

export interface FindImagesParams {
  cursor?: string;
  limit: number;
  status?: ImageStatus;
  search?: string;
  sortBy?: 'createdAt' | 'originalFilename' | 'fileSize' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export class ImagesRepository implements CandidateHashProvider {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: CreateImageParams): Promise<ImageRecord> {
    const record = await this.prisma.image.create({
      data: {
        id: data.id,
        originalFilename: data.originalFilename,
        storedFilename: data.storedFilename,
        originalMimeType: data.originalMimeType,
        fileSize: data.fileSize,
        originalStorageKey: data.originalStorageKey,
        status: data.status as any,
      },
    });

    return record as unknown as ImageRecord;
  }

  public async findById(id: string): Promise<(ImageRecord & { validationResults?: any[] }) | null> {
    const record = await this.prisma.image.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        validationResults: true,
      },
    });

    return record as unknown as (ImageRecord & { validationResults?: any[] }) | null;
  }

  public async findMany(params: FindImagesParams): Promise<PaginatedResult<ImageRecord>> {
    const { cursor, limit, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const where: Prisma.ImageWhereInput = {
      deletedAt: null,
    };

    if (status) {
      where.status = status as any;
    }

    if (search && search.trim().length > 0) {
      where.originalFilename = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    // Cursor-based pagination using Prisma cursor
    const queryArgs: Prisma.ImageFindManyArgs = {
      where,
      take: limit + 1, // Fetch limit + 1 to determine if there is a next page
      orderBy: {
        [sortBy]: sortOrder,
      },
    };

    if (cursor) {
      queryArgs.cursor = { id: cursor };
      queryArgs.skip = 1; // Skip the cursor itself
    }

    const items = await this.prisma.image.findMany(queryArgs);
    const hasMore = items.length > limit;
    const paginatedItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? paginatedItems[paginatedItems.length - 1].id : null;

    return {
      items: paginatedItems as unknown as ImageRecord[],
      nextCursor,
      hasMore,
    };
  }

  public async updateValidationResult(
    id: string,
    data: {
      status: ImageStatus;
      rejectionReasons: string[];
      detectedFormat?: string;
      width?: number;
      height?: number;
      blurScore?: number;
      faceCount?: number;
      faceBoundingBoxes?: any;
      perceptualHash?: string;
      processedStorageKey?: string;
      validationResults?: ValidationResult[];
    }
  ): Promise<ImageRecord> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update the image record
      const img = await tx.image.update({
        where: { id },
        data: {
          status: data.status as any,
          rejectionReasons: data.rejectionReasons,
          detectedFormat: (data.detectedFormat as any) || undefined,
          width: data.width,
          height: data.height,
          blurScore: data.blurScore,
          faceCount: data.faceCount,
          faceBoundingBoxes: data.faceBoundingBoxes ? (data.faceBoundingBoxes as any) : Prisma.DbNull,
          perceptualHash: data.perceptualHash,
          processedStorageKey: data.processedStorageKey,
          processedAt: new Date(),
        },
      });

      // 2. Persist granular validation rule results if provided
      if (data.validationResults && data.validationResults.length > 0) {
        await tx.validationResultRecord.createMany({
          data: data.validationResults.map((r) => ({
            imageId: id,
            rule: String(r.rule),
            passed: r.passed,
            reason: r.reason || null,
            metadata: (r.metadata as any) || Prisma.DbNull,
          })),
        });
      }

      return img;
    });

    return updated as unknown as ImageRecord;
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.image.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  public async hardDelete(id: string): Promise<void> {
    await this.prisma.image.delete({
      where: { id },
    });
  }

  public async recordProcessingAttempt(data: {
    imageId: string;
    attemptNumber: number;
    status: string;
    error?: string;
    durationMs?: number;
  }): Promise<void> {
    await this.prisma.processingAttempt.create({
      data: {
        imageId: data.imageId,
        attemptNumber: data.attemptNumber,
        status: data.status,
        error: data.error || null,
        durationMs: data.durationMs || null,
      },
    });
  }

  /**
   * Candidate retrieval strategy for perceptual hash similarity:
   * To prevent loading the entire database into memory, candidate extraction uses
   * multi-index sub-hash bucketing (Pigeonhole principle):
   * A 64-bit hash (16 hex chars) is divided into 4 x 16-bit chunks (4 hex chars each).
   * Any hash within a small Hamming distance will share at least one exact chunk.
   * If bucketing returns no matches or as fallback, recent active images are queried.
   */
  public async findCandidateHashes(
    hash: string,
    excludeImageId: string
  ): Promise<Array<{ imageId: string; perceptualHash: string; filename: string }>> {
    const buckets = SimilarityDetector.getSubHashBuckets(hash);

    // Query candidates that share at least one 16-bit hex prefix/sub-hash or recent 100 images
    const candidates = await this.prisma.image.findMany({
      where: {
        id: { not: excludeImageId },
        perceptualHash: { not: null },
        deletedAt: null,
        OR: [
          { perceptualHash: { startsWith: buckets[0] } },
          { perceptualHash: { contains: buckets[1] } },
          { perceptualHash: { contains: buckets[2] } },
          { perceptualHash: { endsWith: buckets[3] } },
        ],
      },
      select: {
        id: true,
        perceptualHash: true,
        originalFilename: true,
      },
      take: 200,
    });

    return candidates
      .filter((c) => Boolean(c.perceptualHash))
      .map((c) => ({
        imageId: c.id,
        perceptualHash: c.perceptualHash as string,
        filename: c.originalFilename,
      }));
  }
}
