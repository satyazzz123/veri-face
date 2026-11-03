import { ImageStatus, ImageRecord } from '@image-val/shared';

export interface LocalSelectedFile {
  id: string;
  file: File;
  previewUrl: string;
  status: ImageStatus;
  progress: number;
  error?: string;
  backendId?: string;
}

export type FilterStatus = 'ALL' | ImageStatus.PROCESSING | ImageStatus.ACCEPTED | ImageStatus.REJECTED;

export interface ImageDetailModalState {
  isOpen: boolean;
  image: ImageRecord | null;
}
