# Image Validation & Biometric Algorithm Documentation

This document provides mathematical formulations, implementation details, and scalability trade-offs for all algorithms implemented in the image validation engine.

---

## 1. Magic Bytes & Signature Verification (`FormatValidator`)

### Principle
MIME headers and file extensions sent by HTTP clients are strictly untrusted. The platform inspects the raw leading bytes of the uploaded buffer before any parsing:

| Format | Magic Bytes (Hexadecimal) | Offsets / Notes |
| :--- | :--- | :--- |
| **JPEG** | `FF D8 FF` | Offsets 0..2 |
| **PNG** | `89 50 4E 47 0D 0A 1A 0A` | Offsets 0..7 |
| **HEIC / HEIF** | `66 74 79 70` (`ftyp`) | Offsets 4..7; Major brand at 8..11 (`heic`, `heix`, `heim`, `mif1`) |

After magic byte validation, the buffer header is decoded using Sharp to verify file integrity and prevent malformed binary crashes.

---

## 2. Decompression Bomb & Pixel Flood Defense (`ResolutionValidator`)

### Vulnerability Vector
Decompression bombs (pixel floods / "gzip bombs") use high compression ratios where a tiny 50 KB file unpacks in memory to a gigantic $50,000 \times 50,000$ uncompressed bitmap ($2.5 \text{ Gigapixels} \approx 7.5 \text{ GB RAM}$), crashing Node.js with an Out-Of-Memory (OOM) panic.

### Defense Mechanism
The validator extracts header dimensions without decompressing pixel buffers:
$$\text{Total Pixels} = \text{Width} \times \text{Height}$$
If $\text{Total Pixels} > \text{MAX\_IMAGE\_PIXELS}$ (default: $40,000,000 \text{ px}$ / $40 \text{ Megapixels}$), processing terminates immediately with an early rejection before executing any downstream filters or convolutions.

---

## 3. Laplacian Variance Blur Detection (`BlurDetector`)

### Mathematical Definition
The Laplacian operator is a second-order 2D spatial derivative that emphasizes rapid intensity discontinuities (edges). Sharp images with crisp contours produce large positive and negative spikes in the second derivative, resulting in a **high statistical variance**. Blurry images lack high-frequency edges, yielding a **low variance**.

The discrete 4-neighborhood Laplacian convolution kernel is:
$$L = \begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$

For an image with width $W$ and height $H$ converted to 8-bit grayscale intensity $I(x, y)$:
$$L(x, y) = I(x+1, y) + I(x-1, y) + I(x, y+1) + I(x, y-1) - 4 \cdot I(x, y)$$

The blur score is the sample variance $\sigma^2$ across all $N = (W-2)(H-2)$ interior pixels:
$$\mu = \frac{1}{N} \sum_{x=1}^{W-2} \sum_{y=1}^{H-2} L(x, y)$$
$$\text{Blur Score } (\sigma^2) = \frac{1}{N} \sum_{x=1}^{W-2} \sum_{y=1}^{H-2} (L(x, y) - \mu)^2$$

### Evaluation Rule
- If $\sigma^2 < \text{BLUR\_THRESHOLD}$ (default: $100.0$): **REJECTED** ("Image is too blurry").
- If $\sigma^2 \ge \text{BLUR\_THRESHOLD}$: **ACCEPTED**.

---

## 4. Perceptual Similarity Detection & Candidate Retrieval (`SimilarityDetector`)

### Perceptual Hashing (64-bit DCT pHash & dHash)
Unlike cryptographic hashes (SHA-256) where a single flipped bit produces an entirely different hash (avalanche effect), perceptual hashes map visual structure into a 64-bit fingerprint:
1. Resizes the image to a fixed $32 \times 32$ grayscale matrix.
2. Computes the 2D Discrete Cosine Transform (DCT):
   $$D(u, v) = \frac{1}{4} C(u) C(v) \sum_{x=0}^{31} \sum_{y=0}^{31} I(x, y) \cos\left[\frac{(2x+1)u\pi}{64}\right] \cos\left[\frac{(2y+1)v\pi}{64}\right]$$
3. Retains the $8 \times 8$ lowest frequency coefficients (representing macroscopic structure).
4. Computes the median value across the 64 coefficients (excluding DC component $D(0,0)$).
5. Sets bit $b_i = 1$ if $D_i > \text{median}$, else $0$, yielding a 64-bit fingerprint (16 hexadecimal characters).

### Hamming Distance
The distance $D_H$ between two 64-bit hashes $H_A$ and $H_B$ counts the number of differing bits:
$$D_H(H_A, H_B) = \text{popcount}(H_A \oplus H_B)$$
- If $D_H \le \text{SIMILARITY\_THRESHOLD}$ (default: $8$): **REJECTED** as a duplicate or near-duplicate.

### Candidate Retrieval Strategy & Scalability Trade-offs
Evaluating $D_H$ against millions of rows via linear sequential scan ($O(N)$) causes severe database query latency.
The platform implements **Multi-Index Sub-Hash Bucketing (Pigeonhole Principle)**:
- A 64-bit hash (16 hex characters) is partitioned into 4 disjoint 16-bit blocks:
  $$H = [C_1, C_2, C_3, C_4] \quad \text{where } C_i \in [0..FFFF]$$
- **Pigeonhole Principle**: If two hashes differ by at most $d = 3$ bits, at least one 16-bit block **must be identical** ($\Delta C_i = 0$).
- PostgreSQL queries indexed sub-hash prefixes (`starts_with`, `contains`, `ends_with`) to filter candidates from millions of rows down to $< 100$ candidates in $< 5\text{ms}$.
- Exact Hamming distance is then computed in memory on this small candidate set.

**Scalability Limitations**:
- Sub-hash bucketing is effective for $D_H \le 3$. For $D_H = 8$, candidates are retrieved via multi-block matching + recent image windowing.
- For hyper-scale datasets ($> 100\text{M}$ images), dedicated vector or VP-tree indices (e.g. pgvector or Faiss) should be deployed.

---

## 5. Local CNN Face Detection (`FaceDetector` with OpenCV YuNet)

### Model Architecture
The detector utilizes the official **OpenCV YuNet** convolutional neural network (`face_detection_yunet_2023mar.onnx`, 232 KB) executed locally via Microsoft's **ONNX Runtime Node** (`onnxruntime-node`).

### Multi-Scale Feature Pyramids
YuNet evaluates feature maps at three distinct strides:
- **Stride 8**: Detects small faces ($16 \times 16$ to $64 \times 64 \text{ px}$).
- **Stride 16**: Detects medium faces ($64 \times 64$ to $128 \times 128 \text{ px}$).
- **Stride 32**: Detects large faces ($128 \times 128 \text{ px}$ and above).

### Decoding & Non-Maximum Suppression (NMS)
For each grid location $(r, c)$ at stride $s \in \{8, 16, 32\}$:
$$\text{Score} = \sqrt{\text{cls\_score} \cdot \text{obj\_score}}$$
If $\text{Score} \ge \text{confThreshold}$ ($0.6$):
$$\text{Center}_x = (c + \Delta x) \cdot s, \quad \text{Center}_y = (r + \Delta y) \cdot s$$
$$\text{Width} = e^{\Delta w} \cdot s, \quad \text{Height} = e^{\Delta h} \cdot s$$

Candidate boxes undergo Non-Maximum Suppression with an IoU threshold of $0.3$ to discard duplicate overlaps.

### Evaluation Rules
1. **No-face rejection**: If $\text{Face Count} == 0 \implies$ **REJECTED** ("No face detected in image").
2. **Multiple-face rejection**: If $\text{Face Count} > 1 \implies$ **REJECTED** ("Multiple faces detected").
3. **Small-face rejection**:
   $$\text{Face Area Ratio} = \frac{\text{Width}_{\text{face}} \times \text{Height}_{\text{face}}}{\text{Width}_{\text{image}} \times \text{Height}_{\text{image}}}$$
   If $\text{Face Area Ratio} < \text{FACE\_MIN\_AREA\_RATIO}$ ($0.05$ / $5\%$) $\implies$ **REJECTED** ("Face area is too small").
4. **Acceptance**: Exactly 1 face with area ratio $\ge 0.05 \implies$ **ACCEPTED**.

---

## 6. HEIC/HEIF Decoding & Conversion (`HeicConverter`)

### Transcoding Pipeline
1. Validates ISO Base Media File Format (`ftypheic` / `ftypmif1`).
2. Decodes raw HEIF bitstreams using WebAssembly libheif-js (`heic-convert`).
3. Auto-rotates using EXIF orientation metadata to prevent portrait inversion.
4. Preserves 100% of the original aspect ratio.
5. Re-encodes to a standardized MozJPEG progressive buffer at 92% quality.
6. Stores the converted JPEG under `processed/${uuid}.jpeg` while preserving the untouched original under `originals/${uuid}.heic`.
