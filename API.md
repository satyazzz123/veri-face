# REST API Documentation

The Image Upload & Validation Platform REST API runs on port `4000` (configurable via `PORT`).
Interactive OpenAPI Swagger UI is available at `http://localhost:4000/api-docs`.
Raw OpenAPI 3.0 JSON specification is available at `GET /api/v1/openapi.json`.

---

## Base URL
```
http://localhost:4000/api/v1
```

## Standard Headers
- `x-request-id`: Automatically generated UUID for distributed tracing if not provided. Returned in all response headers.
- `ratelimit-limit`: Maximum number of allowed requests per window.
- `ratelimit-remaining`: Remaining requests in current window.

---

## Endpoints

### 1. Upload Images
**Endpoint:** `POST /api/v1/images`  
**Content-Type:** `multipart/form-data`  
**Rate Limit:** 20 requests per minute per IP.  
**Parameters:**
- `images`: Array of binary files (1 to 10 files). Accepted formats: JPEG, PNG, HEIC. Max size: 10MB per file.

**Response (`202 Accepted`):**
```json
{
  "message": "Images uploaded and queued for processing successfully.",
  "data": {
    "uploadedImages": [
      {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "originalFilename": "portrait.heic",
        "fileSize": 2451020,
        "status": "PROCESSING"
      }
    ]
  }
}
```

---

### 2. List Images
**Endpoint:** `GET /api/v1/images`  
**Query Parameters:**
- `cursor` *(optional)*: UUID of the last image from the previous page.
- `limit` *(optional, default 20, max 100)*: Number of items to retrieve.
- `status` *(optional)*: Filter by `SELECTED`, `UPLOADING`, `UPLOADED`, `PROCESSING`, `ACCEPTED`, `REJECTED`, or `FAILED`.
- `search` *(optional)*: Case-insensitive substring match against `originalFilename`.
- `sortBy` *(optional, default: `createdAt`)*: `createdAt`, `originalFilename`, `fileSize`, or `status`.
- `sortOrder` *(optional, default: `desc`)*: `asc` or `desc`.

**Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "originalFilename": "portrait.heic",
      "storedFilename": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.heic",
      "originalMimeType": "image/heic",
      "detectedFormat": "HEIC",
      "fileSize": 2451020,
      "width": 1920,
      "height": 1080,
      "originalStorageKey": "originals/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.heic",
      "processedStorageKey": "processed/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.jpeg",
      "status": "ACCEPTED",
      "rejectionReasons": [],
      "blurScore": 245.8,
      "faceCount": 1,
      "faceBoundingBoxes": [
        {
          "x": 620,
          "y": 280,
          "width": 380,
          "height": 450,
          "confidence": 0.94
        }
      ],
      "perceptualHash": "d8e4f1a23c5b7890",
      "signedOriginalUrl": "http://localhost:9000/image-uploads/originals/...?X-Amz-Signature=...",
      "signedProcessedUrl": "http://localhost:9000/image-uploads/processed/...?X-Amz-Signature=...",
      "createdAt": "2026-11-03T12:00:00.000Z",
      "updatedAt": "2026-11-03T12:00:03.000Z",
      "processedAt": "2026-11-03T12:00:03.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "8a0cd91b-1234-4321-9876-123456789abc",
    "hasMore": true
  }
}
```

---

### 3. Get Image Details
**Endpoint:** `GET /api/v1/images/:id`  
**Parameters:**
- `id` *(path, UUID)*: Image ID.

**Response (`200 OK`):**
Returns full image metadata with signed S3 preview URLs and granular validation result records.

---

### 4. Get Processing Status
**Endpoint:** `GET /api/v1/images/:id/status`  
**Response (`200 OK`):**
```json
{
  "data": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "REJECTED",
    "rejectionReasons": [
      "Image is too blurry. Blur score is 42.1 (minimum acceptable threshold is 100)."
    ],
    "blurScore": 42.1,
    "faceCount": 1,
    "processedAt": "2026-11-03T12:00:02.000Z"
  }
}
```

---

### 5. Delete Image
**Endpoint:** `DELETE /api/v1/images/:id`  
**Description:** Soft-deletes image metadata from PostgreSQL and deletes the original and processed binary objects from S3/MinIO.

**Response (`200 OK`):**
```json
{
  "message": "Image 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d deleted successfully."
}
```

---

### 6. Real-Time Status Stream (SSE)
**Endpoint:** `GET /api/v1/images/events`  
**Description:** Server-Sent Events stream for push notifications on validation results.  
**Events Emitted:**
- `event: connected`: Confirms SSE registration with `clientId`.
- `event: heartbeat`: Keep-alive event emitted every 15 seconds.
- `event: image:status`: Emitted when an image validation completes or fails:
```json
{
  "imageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "ACCEPTED",
  "rejectionReasons": [],
  "blurScore": 245.8,
  "faceCount": 1,
  "perceptualHash": "d8e4f1a23c5b7890",
  "signedProcessedUrl": "http://localhost:9000/...",
  "updatedAt": "2026-11-03T12:00:03.000Z"
}
```

---

### 7. Health Probes
- `GET /health/live`: Returns `200 UP` with process uptime.
- `GET /health/ready`: Returns `200 READY` when API is configured and ready.
