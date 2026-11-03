import React from 'react';
import { ImageRecord } from '@image-val/shared';
import { ImageCard } from './ImageCard';
import { FilterStatus } from '../types';
import { Image as ImageIcon, SearchX } from 'lucide-react';

interface ImageGridProps {
  images: ImageRecord[];
  isLoading: boolean;
  onSelectImage: (image: ImageRecord) => void;
  onDeleteImage: (id: string) => void;
  isDeleting?: boolean;
  filter: FilterStatus;
  search: string;
}

export function ImageGrid({
  images,
  isLoading,
  onSelectImage,
  onDeleteImage,
  isDeleting,
  filter,
  search,
}: ImageGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900/40 border border-zinc-800 rounded-2xl aspect-[4/5] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl p-16 text-center max-w-lg mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mx-auto mb-4">
          {search ? <SearchX className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          {search ? 'No matching images found' : 'No images in this category'}
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
          {search
            ? `No uploads matched your search query "${search}". Try adjusting terms.`
            : `Images with status ${filter} will appear here after evaluation.`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          onSelect={onSelectImage}
          onDelete={onDeleteImage}
          isDeleting={isDeleting}
        />
      ))}
    </div>
  );
}
