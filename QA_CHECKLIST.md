# Quality Assurance & Testing Checklist

This QA checklist guides manual and automated verification of the platform once external services (PostgreSQL, Redis, and MinIO) are configured.

---

## Pre-Flight Verification Checklist

- [ ] Node.js version $\ge 20.0.0$ installed (`node -v`).
- [ ] pnpm version $\ge 9.0.0$ installed (`pnpm -v`).
- [ ] Root `.env` populated with valid database, redis, and S3 credentials.
- [ ] Prisma database schema migrated: `pnpm db:migrate`.
- [ ] Object storage bucket created and accessible: `S3_BUCKET`.
- [ ] Turborepo workspace built: `pnpm build`.
- [ ] Automated tests passing: `pnpm test`.

---

## Manual Functional QA Scenarios

### 1. Upload & Format Verification
- [ ] **Valid JPEG Upload**: Upload a standard portrait JPEG $> 512 \times 512$. Verify status changes to `ACCEPTED`.
- [ ] **Valid PNG Upload**: Upload a standard portrait PNG. Verify proper format detection and acceptance.
- [ ] **Valid Apple HEIC Upload**: Upload an iPhone `.HEIC` image. Verify:
  - Original `.heic` stored under `originals/`.
  - Converted `.jpeg` stored under `processed/`.
  - Web UI renders the preview thumbnail smoothly without browser HEIC format incompatibility.
- [ ] **Disguised Text File**: Rename a text file to `.jpg` and attempt upload. Verify immediate frontend or backend rejection with message: `Invalid or unsupported image signature`.
- [ ] **Unsupported File Format**: Attempt uploading a `.gif` or `.pdf`. Verify frontend validation blocks submission with clear error indicator.

### 2. Dimension & Resolution Boundary Testing
- [ ] **Low-Resolution Rejection**: Upload an image smaller than $512 \times 512$ (e.g. $300 \times 300$). Verify status is `REJECTED` with reason: `Image dimensions below required minimum resolution of 512x512px`.
- [ ] **Decompression Bomb Protection**: Upload an image exceeding 40,000,000 pixels. Verify immediate pipeline abort preventing memory exhaustion.

### 3. Blur Detection (Laplacian Variance)
- [ ] **Sharp Portrait**: Upload a focused image with sharp facial contours. Verify blur score $> 100$ and passed blur rule.
- [ ] **Out-Of-Focus / Blurry Image**: Upload an intentionally motion-blurred or de-focused image. Verify status is `REJECTED` with reason: `Image is too blurry. Blur score is X (minimum acceptable threshold is 100)`.

### 4. Biometric Face Validation (OpenCV YuNet)
- [ ] **Single Face (Standard Portrait)**: Upload a photo with 1 clear face occupying $> 5\%$ of the frame. Verify status is `ACCEPTED`, face count is `1`, and face bounding box coordinates appear in the detail modal.
- [ ] **Zero Faces (Landscape / Object)**: Upload a picture of a car, building, or nature scenery. Verify status is `REJECTED` with reason: `No face detected in image. The image must contain exactly one clearly visible face`.
- [ ] **Multiple Faces (Group Photo)**: Upload a photo with 2 or more people. Verify status is `REJECTED` with reason: `Multiple faces detected (X faces found). The image must contain exactly one face`.
- [ ] **Tiny Face (< 5% Area)**: Upload a photo where a person is far in the background. Verify status is `REJECTED` with reason: `Face area is too small (X% of total image)`.

### 5. Duplicate & Similarity Detection
- [ ] **Identical Image Upload**: Upload the exact same image twice. Verify the second upload is `REJECTED` with reason: `Duplicate or near-duplicate image detected. Hamming distance is 0`.
- [ ] **Near-Duplicate (Slightly Re-compressed / Resized)**: Re-save an image with slight compression and upload. Verify Hamming distance $\le 8$ triggers duplicate rejection.
- [ ] **Distinct Image**: Upload a completely different photo. Verify Hamming distance $> 8$ and duplicate check passes.

### 6. Real-Time Streaming (SSE)
- [ ] Open the web dashboard in two separate browser tabs.
- [ ] Upload an image in tab A.
- [ ] Observe that tab B immediately displays the new item transitioning from `PROCESSING` $\to$ `ACCEPTED` / `REJECTED` without any page refresh.
- [ ] Inspect DevTools Network tab $\to$ `events` stream confirms periodic keep-alive `heartbeat` events every 15 seconds.

### 7. Deletion & Cleanup
- [ ] Click the trash icon on an image card. Confirm deletion dialog.
- [ ] Verify image disappears from the web UI.
- [ ] Verify database record receives `deletedAt` timestamp.
- [ ] Verify storage objects in S3/MinIO (`originals/` and `processed/`) are safely deleted.
