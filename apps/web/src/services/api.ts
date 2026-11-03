import { ImageRecord, PaginatedResult } from '@image-val/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface UploadProgressCallback {
  (percentage: number): void;
}

export class ApiClient {
  public static getEventsUrl(clientId?: string): string {
    return `${API_BASE_URL}/api/v1/images/events${clientId ? `?clientId=${clientId}` : ''}`;
  }

  public static async uploadImages(
    files: File[],
    onProgress?: UploadProgressCallback
  ): Promise<{ uploadedImages: Array<{ id: string; originalFilename: string }> }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      for (const file of files) {
        formData.append('images', file, file.name);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            resolve(json.data);
          } catch (err) {
            reject(new Error('Invalid JSON response from server'));
          }
        } else {
          try {
            const errorJson = JSON.parse(xhr.responseText);
            reject(new Error(errorJson.message || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during file upload. Please verify the API server is reachable.'));
      });

      xhr.open('POST', `${API_BASE_URL}/api/v1/images`);
      xhr.send(formData);
    });
  }

  public static async getImages(params: {
    cursor?: string;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedResult<ImageRecord>> {
    const query = new URLSearchParams();
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE_URL}/api/v1/images?${query.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch images (${res.status})`);
    }

    const json = await res.json();
    return {
      items: json.data,
      nextCursor: json.pagination?.nextCursor ?? null,
      hasMore: json.pagination?.hasMore ?? false,
    };
  }

  public static async getImage(id: string): Promise<ImageRecord> {
    const res = await fetch(`${API_BASE_URL}/api/v1/images/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch image details (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  public static async deleteImage(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/images/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Failed to delete image (${res.status})`);
    }
  }
}
