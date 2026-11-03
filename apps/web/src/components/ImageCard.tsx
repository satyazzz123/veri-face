import React from 'react';
import { ImageRecord, ImageStatus } from '@image-val/shared';
import { ValidationBadge } from './ValidationBadge';
import { formatBytes, formatDate } from '../lib/utils';
import { Trash2, Eye, User, Sparkles, AlertCircle, FileImage } from 'lucide-react';

interface ImageCardProps {
  image: ImageRecord;
  onSelect: (image: ImageRecord) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export function ImageCard({ image, onSelect, onDelete, isDeleting }: ImageCardProps) {
  const previewUrl = image.signedProcessedUrl || image.signedOriginalUrl;
  const isRejected = image.status === ImageStatus.REJECTED;
  const isProcessing = image.status === ImageStatus.PROCESSING;

  return (
    <div
      onClick={() => onSelect(image)}
      className="group relative bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-black/40 flex flex-col cursor-pointer"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-[4/3] bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-800/80">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={image.originalFilename}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-600 gap-1">
            <FileImage className="w-8 h-8" />
            <span className="text-[10px] uppercase font-mono">{image.detectedFormat || 'Processing'}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <ValidationBadge status={image.status} />
          {image.detectedFormat && (
            <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-zinc-300 border border-white/10 uppercase">
              {image.detectedFormat}
            </span>
          )}
        </div>

        {/* Quick Actions overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900/90 text-white text-xs font-medium shadow-md backdrop-blur-sm border border-zinc-700">
            <Eye className="w-3.5 h-3.5" /> View Analysis
          </span>
        </div>
      </div>

      {/* Content / Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className="text-xs font-semibold text-white truncate max-w-[190px]" title={image.originalFilename}>
              {image.originalFilename}
            </h4>
            <span className="text-[11px] text-zinc-400 font-mono flex-shrink-0">
              {formatBytes(image.fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-3">
            {image.width && image.height ? (
              <span>{image.width} × {image.height} px</span>
            ) : (
              <span>Dimensions: Pending</span>
            )}
            <span>•</span>
            <span>{formatDate(image.createdAt)}</span>
          </div>

          {/* Validation Metrics Pills */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-[11px]">
              <div className="flex items-center gap-1 text-zinc-400 mb-0.5">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Blur Score</span>
              </div>
              <span className="font-semibold text-white font-mono">
                {image.blurScore !== null ? image.blurScore : '—'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-[11px]">
              <div className="flex items-center gap-1 text-zinc-400 mb-0.5">
                <User className="w-3 h-3 text-purple-400" />
                <span>Faces</span>
              </div>
              <span className="font-semibold text-white font-mono">
                {image.faceCount !== null ? image.faceCount : '—'}
              </span>
            </div>
          </div>

          {/* Rejection reasons display */}
          {isRejected && image.rejectionReasons && image.rejectionReasons.length > 0 && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 mb-3">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium mb-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Rejection Reason:</span>
              </div>
              <ul className="text-[11px] text-rose-300/90 list-disc list-inside space-y-0.5">
                {image.rejectionReasons.slice(0, 2).map((reason, idx) => (
                  <li key={idx} className="truncate" title={reason}>
                    {reason}
                  </li>
                ))}
                {image.rejectionReasons.length > 2 && (
                  <li className="text-rose-400 font-semibold">
                    +{image.rejectionReasons.length - 2} more issues
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Bottom Card Footer */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <span className="truncate max-w-[170px] font-mono text-[10px]" title={image.perceptualHash || ''}>
            {image.perceptualHash ? `Hash: #${image.perceptualHash.substring(0, 8)}...` : 'Hash: pending'}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to delete ${image.originalFilename}?`)) {
                onDelete(image.id);
              }
            }}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="Delete image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
