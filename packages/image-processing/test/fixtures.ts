import sharp from 'sharp';

/**
 * Creates a valid JPEG image buffer with crisp geometry and given dimensions.
 */
export async function createValidJpeg(width = 600, height = 600): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="${width / 4}" fill="#38bdf8"/>
      <text x="${width / 2}" y="${height / 2}" font-size="24" fill="#ffffff" text-anchor="middle">Valid JPEG</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Creates a valid PNG image buffer.
 */
export async function createValidPng(width = 600, height = 600): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <rect x="50" y="50" width="${width - 100}" height="${height - 100}" fill="#10b981"/>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Creates an image with high-contrast sharp checkerboard edges (guaranteed high Laplacian variance).
 */
export async function createSharpImage(width = 600, height = 600): Promise<Buffer> {
  const tileSize = 20;
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  for (let x = 0; x < width; x += tileSize) {
    for (let y = 0; y < height; y += tileSize) {
      const fill = ((x / tileSize) + (y / tileSize)) % 2 === 0 ? '#ffffff' : '#000000';
      svg += `<rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" fill="${fill}"/>`;
    }
  }
  svg += '</svg>';

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * Creates an intentionally blurred image with strong Gaussian blur (guaranteed low Laplacian variance < 100).
 */
export async function createBlurredImage(width = 600, height = 600): Promise<Buffer> {
  const base = await createValidJpeg(width, height);
  return sharp(base)
    .blur(15) // Strong blur
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Creates a text file masquerading as a JPEG (invalid magic bytes).
 */
export function createDisguisedTextFile(): Buffer {
  return Buffer.from('This is a plain text file, not a real JPEG image!', 'utf-8');
}

/**
 * Creates a corrupted JPEG buffer (starts with FF D8 FF but contains corrupted payload).
 */
export function createCorruptedJpeg(): Buffer {
  // Starts with JPEG magic bytes FF D8 FF E0 but payload is completely truncated and corrupted
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
}

/**
 * Creates a mock face image with facial geometry (face, eyes, mouth).
 */
export async function createSyntheticFaceImage(width = 600, height = 600): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#262626"/>
      <!-- Face oval (occupies ~25% of image area) -->
      <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 4}" ry="${height / 3}" fill="#ffdbac"/>
      <!-- Left eye -->
      <circle cx="${width / 2 - 50}" cy="${height / 2 - 30}" r="14" fill="#000000"/>
      <!-- Right eye -->
      <circle cx="${width / 2 + 50}" cy="${height / 2 - 30}" r="14" fill="#000000"/>
      <!-- Nose -->
      <polygon points="${width / 2},${height / 2 - 5} ${width / 2 - 10},${height / 2 + 25} ${width / 2 + 10},${height / 2 + 25}" fill="#d19c72"/>
      <!-- Mouth -->
      <path d="M ${width / 2 - 40} ${height / 2 + 65} Q ${width / 2} ${height / 2 + 95} ${width / 2 + 40} ${height / 2 + 65}" stroke="#b91c1c" stroke-width="8" fill="none"/>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 95 })
    .toBuffer();
}
