# Environment Variables Reference

All environment variables are validated at startup via **Zod** (`packages/shared/src/schemas/env.schema.ts`). If any required variable is missing or invalid, the application fails to boot with a clear, actionable error listing each problematic field.

The root `.env` file should be populated with your infrastructure credentials before starting services in production.

---

## Variable Reference Table

| Variable | Required | Default | Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | — | String (URI) | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/image_val?schema=public`) |
| `REDIS_URL` | **Yes** | — | String (URI) | Redis connection URL for BullMQ queue (e.g. `redis://localhost:6379`) |
| `S3_ENDPOINT` | **Yes** | — | String (URI) | S3-compatible endpoint (e.g. `http://localhost:9000` for MinIO) |
| `S3_ACCESS_KEY` | **Yes** | — | String | Storage access key ID |
| `S3_SECRET_KEY` | **Yes** | — | String | Storage secret access key |
| `S3_BUCKET` | **Yes** | — | String | Target bucket name (e.g. `image-uploads`) |
| `S3_REGION` | No | `us-east-1` | String | S3 region |
| `S3_FORCE_PATH_STYLE` | No | `true` | Boolean (`true`/`false`) | Set to `true` for MinIO path-style bucket routing |
| `NODE_ENV` | No | `development` | Enum | `development`, `test`, or `production` |
| `PORT` | No | `4000` | Integer | HTTP port for the Express REST API |
| `WEB_URL` | No | `http://localhost:3000` | String (URL) | Frontend URL for CORS configuration |
| `MAX_FILE_SIZE_MB` | No | `10` | Integer | Maximum upload size per file in megabytes |
| `MAX_FILES_PER_REQUEST` | No | `10` | Integer | Maximum number of files in a single multipart upload |
| `MIN_IMAGE_WIDTH` | No | `512` | Integer | Minimum allowed image width in pixels |
| `MIN_IMAGE_HEIGHT` | No | `512` | Integer | Minimum allowed image height in pixels |
| `MIN_IMAGE_SIZE_BYTES` | No | `10240` | Integer | Minimum allowed file size (10 KB default) |
| `MAX_IMAGE_PIXELS` | No | `40000000` | Integer | Maximum pixel count (40 MP) decompression bomb defense |
| `BLUR_THRESHOLD` | No | `100` | Float | Minimum acceptable Laplacian variance score |
| `FACE_MIN_AREA_RATIO` | No | `0.05` | Float (0.0 to 1.0) | Minimum face area ratio relative to total image area (5%) |
| `SIMILARITY_THRESHOLD` | No | `8` | Integer (0 to 64) | Maximum Hamming distance for perceptual hash duplicate detection |
| `WORKER_CONCURRENCY` | No | `3` | Integer | Number of concurrent jobs processed by the BullMQ worker |
| `UPLOAD_DIR` | No | `./tmp/uploads` | String | Local temporary directory for staged uploads |

---

## Example `.env` File
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

# Upload Restriction Limits
MAX_FILE_SIZE_MB="10"
MAX_FILES_PER_REQUEST="10"

# Image Dimension & Pixel Limits
MIN_IMAGE_WIDTH="512"
MIN_IMAGE_HEIGHT="512"
MIN_IMAGE_SIZE_BYTES="10240"
MAX_IMAGE_PIXELS="40000000"

# Validation Thresholds
BLUR_THRESHOLD="100"
FACE_MIN_AREA_RATIO="0.05"
SIMILARITY_THRESHOLD="8"

# Background Worker Concurrency
WORKER_CONCURRENCY="3"

# Local Temporary File Upload Staging Directory
UPLOAD_DIR="./tmp/uploads"
```
