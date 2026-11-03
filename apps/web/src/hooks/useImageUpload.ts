import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageStatus, DEFAULT_LIMITS } from '@image-val/shared';
import { LocalSelectedFile } from '../types';
import { ApiClient } from '../services/api';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export function useImageUpload() {
  const [selectedFiles, setSelectedFiles] = useState<LocalSelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const queryClient = useQueryClient();

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.includes(ext);
    const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) || file.type === '';

    if (!hasValidExt && !hasValidMime) {
      return `Unsupported format (${ext || file.type}). Permitted types: JPEG, PNG, HEIC.`;
    }

    if (file.size > DEFAULT_LIMITS.MAX_FILE_SIZE_BYTES) {
      return `File exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
    }

    if (file.size < DEFAULT_LIMITS.MIN_IMAGE_SIZE_BYTES) {
      return `File too small (minimum 10 KB required).`;
    }

    return null;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: LocalSelectedFile[] = [];

    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

      // Create browser object URL for preview if not raw HEIC
      let previewUrl = '';
      if (!isHeic && file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        status: error ? ImageStatus.FAILED : ImageStatus.SELECTED,
        progress: 0,
        error: error || undefined,
      });
    });

    setSelectedFiles((prev) => [...prev, ...newItems]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setSelectedFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl && (f.status === ImageStatus.UPLOADED || f.status === ImageStatus.FAILED)) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      return prev.filter(
        (f) => f.status !== ImageStatus.UPLOADED && f.status !== ImageStatus.FAILED
      );
    });
  }, []);

  const uploadBatch = useCallback(async () => {
    const validFiles = selectedFiles.filter(
      (f) => f.status === ImageStatus.SELECTED && !f.error
    );

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setGlobalProgress(0);

    // Mark items as UPLOADING
    setSelectedFiles((prev) =>
      prev.map((item) =>
        validFiles.some((vf) => vf.id === item.id)
          ? { ...item, status: ImageStatus.UPLOADING, progress: 10 }
          : item
      )
    );

    try {
      const rawFiles = validFiles.map((vf) => vf.file);
      const result = await ApiClient.uploadImages(rawFiles, (percentage) => {
        setGlobalProgress(percentage);
        setSelectedFiles((prev) =>
          prev.map((item) =>
            validFiles.some((vf) => vf.id === item.id)
              ? { ...item, progress: percentage }
              : item
          )
        );
      });

      // Mark items as UPLOADED
      setSelectedFiles((prev) =>
        prev.map((item) => {
          const match = result.uploadedImages.find(
            (u) => u.originalFilename === item.file.name
          );
          return validFiles.some((vf) => vf.id === item.id)
            ? {
                ...item,
                status: ImageStatus.UPLOADED,
                progress: 100,
                backendId: match?.id,
              }
            : item;
        })
      );

      // Invalidate images list so backend items show up immediately
      queryClient.invalidateQueries({ queryKey: ['images'] });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Upload failed';
      setSelectedFiles((prev) =>
        prev.map((item) =>
          validFiles.some((vf) => vf.id === item.id)
            ? { ...item, status: ImageStatus.FAILED, error: errMsg }
            : item
        )
      );
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, queryClient]);

  return {
    selectedFiles,
    isUploading,
    globalProgress,
    addFiles,
    removeFile,
    clearCompleted,
    uploadBatch,
  };
}
