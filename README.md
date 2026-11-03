# Production-Grade Image Upload & Validation Platform

A complete, production-grade image upload and multi-stage biometric validation platform built with TypeScript, Next.js App Router, Express, BullMQ, Prisma, Sharp, and local CNN face detection via OpenCV YuNet.

---

## 🚀 Key Highlights & Implemented Features

1. **Clean Architecture & Turborepo Monorepo**: Decoupled presentation, HTTP transport, domain services, background workers, and algorithmic packages using `pnpm` workspaces.
2. **Asynchronous Background Processing (BullMQ & Redis)**: Zero image processing inside HTTP request lifecycles. High-throughput queuing with exponential backoff retries, configurable concurrency, and idempotency.
3. **Multi-Stage 15-Step Validation Pipeline**:
   - Magic bytes / file signature inspection (never trusts MIME headers).
   - Real HEIC/HEIF decoding to progressive MozJPEG with EXIF orientation preservation.
   - Decompression bomb / pixel flood protection (40 MP limit).
   - Strict resolution limits ($512 \times 512 \text{ px}$ minimum).
   - Laplacian variance blur detection ($\sigma^2 \ge 100$).
   - Real local CNN face detection via OpenCV YuNet ONNX: enforces single-face constraint, rejects multiple faces, rejects missing faces, and calculates face area ratio ($\ge 5\%$).
   - 64-bit DCT perceptual hashing (pHash/dHash) with Hamming distance comparison and sub-hash candidate bucketing.
4. **S3 / MinIO Object Storage**: AWS SDK v3 client supporting private buckets, UUID key partitioning (`originals/` vs `processed/`), streaming, safe deletion, and time-limited HMAC presigned preview URLs.
5. **Real-Time Push Updates (SSE)**: Server-Sent Events stream (`/api/v1/images/events`) with 15-second heartbeat intervals, auto-reconnect, and `@tanstack/react-query` cache invalidation.
6. **Responsive Next.js Dashboard**: Drag-and-drop file upload, multiple selection, individual file progress, accepted/rejected categorization, rejection reason displays, and SVG face bounding box overlays.
7. **Production Security**: Strict Zod environment validation, Helmet security headers, CORS origin enforcement, rate limiting, request tracing (`x-request-id`), and centralized error formatting.
8. **Automated Test Coverage**: 36 unit and integration test cases across all packages verifying format detection, blur variance, perceptual hashing, file size limits, resolution validation, API endpoints, and frontend validation.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, TanStack Query v5, Lucide React, Zod |
| **Backend API** | Node.js (v20+ / v24), Express 4, TypeScript, Prisma ORM, BullMQ, Redis (ioredis), Pino, Helmet, CORS, Multer |
| **Image Processing** | Sharp, ONNX Runtime Node (`onnxruntime-node`), OpenCV YuNet (`face_detection_yunet_2023mar.onnx`), `heic-convert` (WASM) |
| **Database** | PostgreSQL with Prisma ORM (indexes on status, timestamps, hash, soft deletion) |
| **Storage** | S3-compatible storage (AWS SDK v3 `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, MinIO) |
| **Monorepo Tooling** | Turborepo, pnpm workspaces, tsup, Vitest, Supertest |

---

## 📁 Repository Structure

```
image-val/
├── apps/
│   ├── api/                     # Express REST API, S3 adapter, and BullMQ worker
│   │   ├── src/
│   │   │   ├── config/          # Zod env schema & OpenAPI Swagger configuration
│   │   │   ├── infrastructure/  # Storage (S3/MinIO), Queue (BullMQ), Logger (Pino)
│   │   │   ├── middleware/      # Rate limiter, Request-ID, Error handling, Zod validation
│   │   │   ├── modules/
│   │   │   │   ├── images/      # Images controller, service, repository, routes
│   │   │   │   └── health/      # Health check probes (/health/live, /health/ready)
│   │   │   ├── utils/           # Server-Sent Events (SSE) Manager
│   │   │   ├── workers/         # Dedicated BullMQ Image Processor Worker
│   │   │   └── index.ts         # Server entry point & OpenAPI mounting
│   │   └── test/                # Supertest API & S3 adapter test suites
│   │
│   └── web/                     # Next.js 14 App Router Frontend Dashboard
│       ├── src/
│       │   ├── app/             # App Router layout, page, providers, globals.css
│       │   ├── components/      # Dropzone, QueueList, ImageCard, Grid, DetailModal
│       │   ├── hooks/           # useImageUpload, useImages, useImageEvents (SSE)
│       │   ├── lib/             # Utility helpers (cn, formatBytes, formatDate)
│       │   ├── services/        # Client-side API client with XHR progress tracking
│       │   └── types/           # UI state interfaces
│       └── test/                # Frontend validation unit tests
│
├── packages/
│   ├── shared/                  # Common TypeScript schemas, enums, types, limits
│   ├── database/                # Prisma ORM schema, SQL migrations, and client export
│   └── image-processing/        # Pure algorithmic validation engine (Sharp, YuNet, HEIC, pHash)
│       ├── models/              # OpenCV YuNet ONNX face detection model
│       └── test/                # Real fixture-based test suites
│
├── .env.example                 # Environment configuration template
├── .env                         # Root environment configuration (placeholders)
├── ARCHITECTURE.md              # Detailed architecture, data flow & mermaid diagrams
├── API.md                       # Complete REST API & SSE specification
├── ENV.md                       # Environment variables documentation
├── ALGORITHMS.md                # Mathematical formulations & candidate retrieval trade-offs
└── QA_CHECKLIST.md              # Quality assurance & manual testing guide
```

---

## ⚙️ Quick Start Guide

### Step 1: Install Dependencies & Build Workspace
```bash
# Install all monorepo dependencies
pnpm install

# Rebuild native modules (sharp, onnxruntime-node, prisma)
pnpm rebuild

# Build all packages and apps via Turborepo
pnpm build
```

### Step 2: Configure Environment Variables
Open the root `.env` file and fill in your infrastructure connection strings:
```env
# Infrastructure Credentials (Fill these in with your PostgreSQL, Redis, and MinIO instances)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/image_val?schema=public"
REDIS_URL="redis://localhost:6379"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="image-uploads"
S3_REGION="us-east-1"
S3_FORCE_PATH_STYLE="true"

# Application Settings
NODE_ENV="development"
PORT="4000"
WEB_URL="http://localhost:3000"
```

*(See [ENV.md](file:///c:/Users/satyajit/Desktop/image-val/ENV.md) for full descriptions of all 22 environment parameters).*

### Step 3: Run Database Migrations
Once your PostgreSQL instance is running:
```bash
pnpm db:migrate
```
*(This applies the initial migration in `packages/database/prisma/migrations/20261103000000_init/migration.sql`).*

### Step 4: Start Services

You can run services independently or concurrently:

#### Option A: Run everything concurrently
```bash
pnpm dev
```

#### Option B: Run each service in its own terminal
```bash
# Terminal 1: Express REST API (Port 4000)
pnpm api:dev

# Terminal 2: BullMQ Image Processing Worker
pnpm worker:dev

# Terminal 3: Next.js Frontend Dashboard (Port 3000)
pnpm web:dev
```

---

## 🧪 Testing Instructions

Run automated tests across all packages using Vitest:
```bash
# Run all tests across shared, image-processing, api, and web packages
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests for a specific package
pnpm --filter @image-val/image-processing test
pnpm --filter @image-val/api test
pnpm --filter @image-val/web test
```

All 36 tests run without external dependencies by using in-memory fixtures and real algorithmic calculations.

---

## 📖 Documentation Links

- **Architecture & Design**: [ARCHITECTURE.md](file:///c:/Users/satyajit/Desktop/image-val/ARCHITECTURE.md)
- **REST API & SSE Specification**: [API.md](file:///c:/Users/satyajit/Desktop/image-val/API.md)
- **Environment Variables**: [ENV.md](file:///c:/Users/satyajit/Desktop/image-val/ENV.md)
- **Algorithms & Mathematical Models**: [ALGORITHMS.md](file:///c:/Users/satyajit/Desktop/image-val/ALGORITHMS.md)
- **Manual QA Checklist**: [QA_CHECKLIST.md](file:///c:/Users/satyajit/Desktop/image-val/QA_CHECKLIST.md)
- **Interactive Swagger UI**: `http://localhost:4000/api-docs`
