-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('SELECTED', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "DetectedFormat" AS ENUM ('JPEG', 'PNG', 'HEIC', 'HEIF', 'UNKNOWN');

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "originalMimeType" TEXT NOT NULL,
    "detectedFormat" "DetectedFormat" NOT NULL DEFAULT 'UNKNOWN',
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalStorageKey" TEXT NOT NULL,
    "processedStorageKey" TEXT,
    "status" "ImageStatus" NOT NULL DEFAULT 'PROCESSING',
    "rejectionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blurScore" DOUBLE PRECISION,
    "faceCount" INTEGER,
    "faceBoundingBoxes" JSONB,
    "perceptualHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_attempts" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "images_status_idx" ON "images"("status");

-- CreateIndex
CREATE INDEX "images_createdAt_idx" ON "images"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "images_perceptualHash_idx" ON "images"("perceptualHash");

-- CreateIndex
CREATE INDEX "images_deletedAt_idx" ON "images"("deletedAt");

-- CreateIndex
CREATE INDEX "images_originalFilename_idx" ON "images"("originalFilename");

-- CreateIndex
CREATE INDEX "validation_results_imageId_idx" ON "validation_results"("imageId");

-- CreateIndex
CREATE INDEX "validation_results_rule_idx" ON "validation_results"("rule");

-- CreateIndex
CREATE INDEX "processing_attempts_imageId_idx" ON "processing_attempts"("imageId");

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_attempts" ADD CONSTRAINT "processing_attempts_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
