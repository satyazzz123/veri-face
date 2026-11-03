import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { getEnv, getEnvMockDefaults } from './config/env.js';
import { logger, httpLogger } from './infrastructure/logger/logger.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { generalRateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { getPrismaClient } from '@image-val/database';
import { S3StorageAdapter } from './infrastructure/storage/s3-storage.adapter.js';
import { getImageValidationQueue, closeQueueConnections } from './infrastructure/queue/bullmq-queue.js';
import { ImagesRepository } from './modules/images/images.repository.js';
import { ImagesService } from './modules/images/images.service.js';
import { ImagesController } from './modules/images/images.controller.js';
import { createImagesRouter } from './modules/images/images.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { openApiSpec } from './config/swagger.js';
import { sseManager } from './utils/sse-manager.js';

export function createApp(envOverride?: Partial<ReturnType<typeof getEnv>>): express.Express {
  const env = envOverride
    ? ({ ...getEnvMockDefaults(), ...envOverride } as ReturnType<typeof getEnv>)
    : getEnv();
  const app: express.Express = express();

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to render inline assets
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: [env.WEB_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    })
  );

  // Request ID & Logging
  app.use(requestIdMiddleware);
  if (env.NODE_ENV !== 'test') {
    app.use(httpLogger);
  }

  // Rate Limiting
  app.use(generalRateLimiter);

  // Body Parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Dependency Injection Wiring
  const prisma = getPrismaClient(env.DATABASE_URL);
  const repository = new ImagesRepository(prisma);

  const storage = new S3StorageAdapter({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });

  const queue = getImageValidationQueue(env.REDIS_URL);
  const imagesService = new ImagesService(repository, storage, queue);
  const imagesController = new ImagesController(imagesService);

  // API Documentation
  app.get('/api/v1/openapi.json', (_req, res) => res.json(openApiSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Health check routes
  app.use('/health', createHealthRouter());

  // Images API routes
  app.use('/api/v1/images', createImagesRouter(imagesController));

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}

export const app: express.Express = process.env.NODE_ENV === 'test' ? (null as any) : createApp();

// Start HTTP server if run as main module
if (process.env.NODE_ENV !== 'test') {
  const isMain = process.argv[1]?.includes('dist/index.js') || process.argv[1]?.includes('src/index.ts');
  if (isMain) {
    const env = getEnv();
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Image Validation API listening on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📖 OpenAPI Documentation: http://localhost:${env.PORT}/api-docs`);
    });

    const shutdown = async () => {
      logger.info('Shutting down API server gracefully...');
      sseManager.close();
      await closeQueueConnections();
      server.close(() => {
        logger.info('API server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}
