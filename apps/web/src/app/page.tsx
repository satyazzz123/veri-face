'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { StatsOverview } from '../components/StatsOverview';
import { ImageDropzone } from '../components/ImageDropzone';
import { UploadQueueList } from '../components/UploadQueueList';
import { FilterTabs } from '../components/FilterTabs';
import { ImageGrid } from '../components/ImageGrid';
import { ImageDetailModal } from '../components/ImageDetailModal';
import { useImageUpload } from '../hooks/useImageUpload';
import { useImageEvents } from '../hooks/useImageEvents';
import { useImages } from '../hooks/useImages';
import { FilterStatus } from '../types';
import { ImageRecord } from '@image-val/shared';

export default function DashboardPage() {
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [search, setSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);

  // Real-time Server-Sent Events (SSE) hook
  const { isConnected: isSSEConnected } = useImageEvents();

  // Local file upload management hook
  const {
    selectedFiles,
    isUploading,
    globalProgress,
    addFiles,
    removeFile,
    clearCompleted,
    uploadBatch,
  } = useImageUpload();

  // Server state images query hook
  const { images, isLoading, deleteImage, isDeleting } = useImages(filter, search);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Header isSSEConnected={isSSEConnected} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metric Cards */}
        <StatsOverview images={images} />

        {/* Upload Staging Area */}
        <div className="mb-8">
          <ImageDropzone
            onFilesSelected={addFiles}
            isUploading={isUploading}
          />
        </div>

        {/* Staged Upload Queue (Shown when files are selected) */}
        <UploadQueueList
          files={selectedFiles}
          onRemove={removeFile}
          onUpload={uploadBatch}
          onClearCompleted={clearCompleted}
          isUploading={isUploading}
          globalProgress={globalProgress}
        />

        {/* Gallery / Validation Output Section */}
        <div className="mt-6">
          <FilterTabs
            currentFilter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
          />

          <ImageGrid
            images={images}
            isLoading={isLoading}
            onSelectImage={setSelectedImage}
            onDeleteImage={deleteImage}
            isDeleting={isDeleting}
            filter={filter}
            search={search}
          />
        </div>

        {/* Full Image Analysis Detail Modal */}
        <ImageDetailModal
          image={selectedImage}
          isOpen={Boolean(selectedImage)}
          onClose={() => setSelectedImage(null)}
        />
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <p>Production Image Upload & Validation Platform • TypeScript • Next.js • Express • BullMQ • Sharp • OpenCV YuNet</p>
      </footer>
    </div>
  );
}
