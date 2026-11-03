import { Router } from 'express';
import multer from 'multer';
import {
  DEFAULT_LIMITS,
  ImageIdParamSchema,
  ImageListQuerySchema,
} from '@image-val/shared';
import { ImagesController } from './images.controller.js';
import { validateRequest } from '../../middleware/validation.js';
import { uploadRateLimiter } from '../../middleware/rate-limiter.js';

export function createImagesRouter(controller: ImagesController): Router {
  const router = Router();

  // Configure Multer for in-memory upload buffering
  const maxFileSizeBytes =
    (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) || DEFAULT_LIMITS.MAX_FILE_SIZE_MB) * 1024 * 1024;
  const maxFiles =
    parseInt(process.env.MAX_FILES_PER_REQUEST || '10', 10) || DEFAULT_LIMITS.MAX_FILES_PER_REQUEST;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes,
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
      if (allowed.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported MIME type "${file.mimetype}". Allowed types: JPEG, PNG, HEIC.`));
      }
    },
  });

  // GET /api/v1/images/events - SSE Stream for real-time status updates
  router.get('/events', controller.events);

  // POST /api/v1/images - Upload images
  router.post(
    '/',
    uploadRateLimiter,
    upload.array('images', maxFiles),
    controller.upload
  );

  // GET /api/v1/images - List images (paginated, filtered, sorted, searched)
  router.get(
    '/',
    validateRequest({ query: ImageListQuerySchema }),
    controller.list
  );

  // GET /api/v1/images/:id - Retrieve image metadata and validation results
  router.get(
    '/:id',
    validateRequest({ params: ImageIdParamSchema }),
    controller.getById
  );

  // GET /api/v1/images/:id/status - Retrieve current processing status
  router.get(
    '/:id/status',
    validateRequest({ params: ImageIdParamSchema }),
    controller.getStatus
  );

  // DELETE /api/v1/images/:id - Safely delete image metadata and storage objects
  router.delete(
    '/:id',
    validateRequest({ params: ImageIdParamSchema }),
    controller.delete
  );

  return router;
}
