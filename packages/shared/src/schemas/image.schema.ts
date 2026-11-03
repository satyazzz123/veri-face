import { z } from 'zod';
import { ImageStatus } from '../types/image.js';

export const ImageListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  status: z.nativeEnum(ImageStatus).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'originalFilename', 'fileSize', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ImageListQuery = z.infer<typeof ImageListQuerySchema>;

export const ImageIdParamSchema = z.object({
  id: z.string().uuid('Image ID must be a valid UUID'),
});

export type ImageIdParam = z.infer<typeof ImageIdParamSchema>;
