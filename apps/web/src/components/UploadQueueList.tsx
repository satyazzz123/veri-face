import React from 'react';
import { LocalSelectedFile } from '../types';
import { ImageStatus } from '@image-val/shared';
import { ValidationBadge } from './ValidationBadge';
import { formatBytes } from '../lib/utils';
import { X, Upload, CheckCircle2, AlertCircle, FileImage } from 'lucide-react';

interface UploadQueueListProps {
  files: LocalSelectedFile[];
  onRemove: (id: string) => void;
  onUpload: () => void;
  onClearCompleted: () => void;
  isUploading: boolean;
  globalProgress: number;
}

export function UploadQueueList({
  files,
  onRemove,
  onUpload,
  onClearCompleted,
  isUploading,
  globalProgress,
}: UploadQueueListProps) {
  if (files.length === 0) return null;

  const validCount = files.filter(
    (f) => f.status === ImageStatus.SELECTED && !f.error
  ).length;

  const hasCompleted = files.some(
    (f) => f.status === ImageStatus.UPLOADED || f.status === ImageStatus.FAILED
  );

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-8 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div>
          <h4 className="text-sm font-semibold text-white">Staged Upload Queue</h4>
          <p className="text-xs text-zinc-400">
            {files.length} {files.length === 1 ? 'file' : 'files'} selected • {validCount} ready for upload
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasCompleted && (
            <button
              onClick={onClearCompleted}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
            >
              Clear Completed
            </button>
          )}

          <button
            onClick={onUpload}
            disabled={validCount === 0 || isUploading}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? `Uploading (${globalProgress}%)` : `Upload ${validCount} Files`}
          </button>
        </div>
      </div>

      {/* Global progress bar */}
      {isUploading && (
        <div className="mb-4">
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Files list */}
      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {files.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Preview Thumbnail */}
              <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileImage className="w-6 h-6 text-zinc-500" />
                )}
              </div>

              {/* File Info */}
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate max-w-xs sm:max-w-md">
                  {item.file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                  <span>{formatBytes(item.file.size)}</span>
                  <span>•</span>
                  <span className="uppercase">{item.file.name.split('.').pop()}</span>
                  {item.error && (
                    <>
                      <span>•</span>
                      <span className="text-rose-400 truncate max-w-[200px] sm:max-w-[300px]">
                        {item.error}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <ValidationBadge status={item.status} />

              {item.status === ImageStatus.SELECTED && !isUploading && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
