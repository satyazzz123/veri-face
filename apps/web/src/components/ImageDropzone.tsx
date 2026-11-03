import React, { useRef, useState } from 'react';
import { UploadCloud, FileImage, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function ImageDropzone({ onFilesSelected, isUploading, disabled }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    if (fileInputRef.current && !disabled && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input value so same files can be re-selected if removed
      e.target.value = '';
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 group',
        isDragging
          ? 'border-blue-500 bg-blue-500/10 scale-[1.008]'
          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60',
        disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-200',
            isDragging
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700'
          )}
        >
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-base font-semibold text-white mb-1">
          {isDragging ? 'Drop images here to upload' : 'Click to upload or drag and drop'}
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          Select single or multiple files for biometric & quality validation
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-400">
          <span className="px-2 py-1 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 font-mono">
            JPEG
          </span>
          <span className="px-2 py-1 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 font-mono">
            PNG
          </span>
          <span className="px-2 py-1 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 font-mono">
            HEIC / HEIF
          </span>
          <span className="text-zinc-500">•</span>
          <span>Max 10MB per file</span>
          <span className="text-zinc-500">•</span>
          <span>Min 512x512 px</span>
        </div>
      </div>
    </div>
  );
}
