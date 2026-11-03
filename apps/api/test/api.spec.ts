import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Set up mock test environment variables before initializing the app
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/image_val_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_ACCESS_KEY = 'mock-access-key';
process.env.S3_SECRET_KEY = 'mock-secret-key';
process.env.S3_BUCKET = 'mock-bucket';

import { createApp } from '../src/index.js';

describe('Express REST API Endpoints', () => {
  const app = createApp();

  describe('Health Probes', () => {
    it('GET /health/live should return 200 UP', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.uptime).toBeDefined();
    });

    it('GET /health/ready should return 200 READY', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.service).toBe('image-validation-api');
    });
  });

  describe('OpenAPI Documentation', () => {
    it('GET /api/v1/openapi.json should return OpenAPI 3.0 specification', async () => {
      const res = await request(app).get('/api/v1/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('Image Upload');
      expect(res.body.paths['/images']).toBeDefined();
    });
  });

  describe('Middleware & Security Headers', () => {
    it('should attach x-request-id header to every response', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should respect custom incoming x-request-id header', async () => {
      const customId = 'custom-trace-uuid-1234';
      const res = await request(app).get('/health/live').set('x-request-id', customId);
      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('should attach rate limit headers', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Input Validation Middleware', () => {
    it('GET /api/v1/images/:id with invalid UUID should return 400 Validation Error', async () => {
      const res = await request(app).get('/api/v1/images/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.issues).toBeDefined();
      expect(res.body.issues[0].message).toContain('valid UUID');
    });

    it('GET /api/v1/images with invalid limit should return 400', async () => {
      const res = await request(app).get('/api/v1/images?limit=999');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('POST /api/v1/images without multipart files should return 400 Bad Request', async () => {
      const res = await request(app).post('/api/v1/images');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No image files provided');
    });
  });
});
