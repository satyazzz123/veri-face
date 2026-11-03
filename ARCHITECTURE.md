# System Architecture & Technical Design

## 1. Overview & Architectural Principles

The Image Upload & Validation Platform is architected as an asynchronous, event-driven, decoupled system built inside a Turborepo monorepo with pnpm. The platform adheres strictly to Clean Architecture principles:
- **Presentation Layer (Web)**: Next.js App Router, Tailwind CSS, TanStack Query, and React Hooks.
- **API Transport Layer (Express)**: Handles routing, security, rate limiting, and HTTP dispatch without encapsulating business logic.
- **Domain Services & Repositories**: Pure business logic and database abstractions.
- **Asynchronous Worker Engine**: Standalone BullMQ workers executing compute-intensive image processing pipelines outside the HTTP request lifecycle.
- **Infrastructure Adapters**: Decoupled S3/MinIO storage clients, PostgreSQL Prisma repositories, and Redis queues.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        UI["Next.js Web Dashboard"]
    end

    subgraph Gateway["API Gateway Tier (Express)"]
        RT["Rate Limiter & Helmet"]
        VAL["Zod Validation & Magic Bytes"]
        API["Express Images Controller"]
        SSE["SSE Manager (Broadcast Registry)"]
    end

    subgraph Storage["Storage & Persistence Tier"]
        MINIO[("S3 / MinIO Object Storage")]
        PG[("PostgreSQL Database (Prisma)")]
        REDIS[("Redis (BullMQ Broker)")]
    end

    subgraph Processing["Worker Processing Tier"]
        WORKER["Image Processing Worker (BullMQ)"]
        PIPE["15-Step Validation Pipeline"]
        YUNET["YuNet CNN Face Detector (ONNX)"]
        SHARP["Sharp Image Engine & Laplacian"]
        HEIC["HEIC/HEIF Decoder (WASM)"]
    end

    UI -->|"1. Multipart Upload (up to 10 files)"| RT
    RT --> VAL
    VAL --> API
    API -->|"2. Stream original binary"| MINIO
    API -->|"3. Insert metadata (PROCESSING)"| PG
    API -->|"4. Enqueue validation job"| REDIS
    API -.->|"5. Immediate 202 Accepted Response"| UI

    REDIS -->|"6. Pull job"| WORKER
    WORKER -->|"7. Download original binary"| MINIO
    WORKER -->|"8. Execute Pipeline"| PIPE
    PIPE --> SHARP
    PIPE --> YUNET
    PIPE --> HEIC
    PIPE -->|"9. Return results"| WORKER

    WORKER -->|"10. Upload converted JPEG (if HEIC)"| MINIO
    WORKER -->|"11. Persist status & biometrics"| PG
    WORKER -->|"12. Dispatch status update"| SSE
    SSE -->|"13. Real-Time Push (EventSource)"| UI
```

---

## 3. Monorepo Organization

```
image-val/
├── apps/
│   ├── api/                     # Express REST API & Standalone Background Worker
│   │   ├── src/
│   │   │   ├── config/          # Environment & Swagger OpenAPI configuration
│   │   │   ├── infrastructure/  # Storage (S3/MinIO), Queue (BullMQ), Database, Logger (Pino)
│   │   │   ├── middleware/      # Rate limiter, Request-ID, Error handler, Zod validation
│   │   │   ├── modules/
│   │   │   │   ├── images/      # Images controller, service, repository, routes
│   │   │   │   └── health/      # Health check probes (/health/live, /health/ready)
│   │   │   ├── utils/           # Server-Sent Events (SSE) Manager
│   │   │   ├── workers/         # Dedicated BullMQ Image Processor Worker
│   │   │   └── index.ts         # Server entry point
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
│   │   ├── src/
│   │   │   ├── constants/       # File size, dimension, and threshold constants
│   │   │   ├── schemas/         # Zod schemas for env, query, and pagination
│   │   │   └── types/           # Shared domain models & event payloads
│   │
│   ├── database/                # Prisma ORM schema, migrations, and client
│   │   ├── prisma/
│   │   │   ├── migrations/      # Production SQL migration files
│   │   │   └── schema.prisma    # Image, ValidationResultRecord, ProcessingAttempt
│   │   └── src/index.ts         # Client singleton with lazy connection
│   │
│   └── image-processing/        # Pure algorithmic validation engine
│       ├── models/              # OpenCV YuNet ONNX face detection model
│       ├── src/
│       │   ├── converters/      # HEIC/HEIF decoder & JPEG converter
│       │   ├── detectors/       # Laplacian blur, YuNet face detector, pHash/dHash
│       │   ├── pipeline/        # 15-stage modular orchestrator
│       │   └── validators/      # Magic bytes format, file size, resolution
│       └── test/                # Real fixture-based test suites (36 tests)
```

---

## 4. Key Subsystem Implementations

### A. Object Storage Layer (`apps/api/src/infrastructure/storage`)
- Implements `ObjectStorage` interface wrapping `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- Works transparently with Amazon S3 or self-hosted MinIO via `S3_FORCE_PATH_STYLE="true"` and endpoint overrides.
- Private bucket design: Objects are never publicly readable. All previews use time-limited HMAC-signed URLs (1 hour expiration).
- Key partitioning:
  - `originals/${uuid}.${ext}`
  - `processed/${uuid}.jpeg`

### B. Asynchronous Job Processing (`apps/api/src/workers`)
- BullMQ queue `image-validation` powered by Redis.
- Configurable worker concurrency (`WORKER_CONCURRENCY=3`).
- Idempotent execution using `jobId: imageId`.
- Exponential backoff retry strategy (`delay: 2000 * 2^attempts`, 3 attempts).
- Dead-letter handling: marks image as `FAILED` in PostgreSQL and audits the error stack.

### C. Real-Time Status Notification (`apps/api/src/utils/sse-manager.ts`)
- Server-Sent Events (SSE) streaming endpoint `/api/v1/images/events`.
- Heartbeat pings every 15 seconds to prevent NAT/proxy disconnection.
- Auto-reconnect with exponential backoff on the Next.js frontend.
- Live cache invalidation on `@tanstack/react-query`.
