import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] || 'unknown';

  logger.error({
    err,
    requestId,
    method: req.method,
    url: req.url,
  }, 'Unhandled request error');

  if (res.headersSent) {
    return;
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      error: 'File Too Large',
      message: 'One or more files exceed the maximum allowed file size.',
      requestId,
    });
    return;
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    res.status(400).json({
      error: 'Too Many Files',
      message: 'Exceeded maximum number of files per upload request.',
      requestId,
    });
    return;
  }

  if (err.name === 'ZodError' || Array.isArray(err.issues)) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      issues: (err.issues || []).map((e: any) => ({
        field: e.path ? e.path.join('.') : '',
        message: e.message,
      })),
      requestId,
    });
    return;
  }

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: isProd && statusCode === 500 ? 'An unexpected error occurred.' : (err.message || 'Unknown error'),
    requestId,
  });
}
