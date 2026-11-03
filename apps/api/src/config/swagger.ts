export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Image Upload & Validation Platform API',
    version: '1.0.0',
    description:
      'Production-grade REST API for secure image upload, background validation, biometric checks, and real-time status streaming.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base Endpoint',
    },
  ],
  paths: {
    '/images': {
      post: {
        summary: 'Upload images for background validation',
        description:
          'Accepts multipart/form-data with up to 10 images (JPEG, PNG, HEIC). Performs magic-byte inspection, stores in S3/MinIO, enqueues BullMQ background validation, and returns immediately with image IDs.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  images: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary',
                    },
                    description: 'Images to validate (JPEG, PNG, HEIC)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Images successfully uploaded and queued for processing',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        uploadedImages: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/ImageSummary',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Bad Request (invalid file signature or size limit exceeded)' },
          '429': { description: 'Too Many Requests (Rate limit exceeded)' },
        },
      },
      get: {
        summary: 'List images with cursor pagination, status filtering, and filename search',
        parameters: [
          { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Pagination cursor (Image ID)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Number of items per page' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['SELECTED', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'FAILED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filename substring search' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'originalFilename', 'fileSize', 'status'], default: 'createdAt' } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of images with signed preview URLs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ImageRecord' },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        nextCursor: { type: 'string', nullable: true },
                        hasMore: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/images/{id}': {
      get: {
        summary: 'Retrieve image metadata, validation results, and signed preview URLs',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Image metadata and detailed validation report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/ImageRecord' },
                  },
                },
              },
            },
          },
          '404': { description: 'Image not found' },
        },
      },
      delete: {
        summary: 'Safely delete image metadata and associated S3/MinIO objects',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Image and storage objects deleted successfully' },
          '404': { description: 'Image not found' },
        },
      },
    },
    '/images/{id}/status': {
      get: {
        summary: 'Retrieve current processing status and rejection reasons',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Current status of the image',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        status: { type: 'string' },
                        rejectionReasons: { type: 'array', items: { type: 'string' } },
                        blurScore: { type: 'number', nullable: true },
                        faceCount: { type: 'integer', nullable: true },
                        processedAt: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/images/events': {
      get: {
        summary: 'Server-Sent Events (SSE) stream for real-time validation status updates',
        parameters: [
          { name: 'clientId', in: 'query', schema: { type: 'string' }, description: 'Unique SSE client subscription ID' },
        ],
        responses: {
          '200': {
            description: 'Event stream connection established',
            content: {
              'text/event-stream': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ImageSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          originalFilename: { type: 'string' },
          fileSize: { type: 'integer' },
          status: { type: 'string' },
        },
      },
      ImageRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          originalFilename: { type: 'string' },
          storedFilename: { type: 'string' },
          originalMimeType: { type: 'string' },
          detectedFormat: { type: 'string' },
          fileSize: { type: 'integer' },
          width: { type: 'integer', nullable: true },
          height: { type: 'integer', nullable: true },
          status: { type: 'string', enum: ['SELECTED', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'FAILED'] },
          rejectionReasons: { type: 'array', items: { type: 'string' } },
          blurScore: { type: 'number', nullable: true },
          faceCount: { type: 'integer', nullable: true },
          faceBoundingBoxes: { type: 'object', nullable: true },
          perceptualHash: { type: 'string', nullable: true },
          signedOriginalUrl: { type: 'string', nullable: true },
          signedProcessedUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          processedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
};
