import { Router, Request, Response } from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', (_req: Request, res: Response) => {
    // Returns 200 indicating the application instance is initialized and accepting traffic
    res.status(200).json({
      status: 'READY',
      service: 'image-validation-api',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
