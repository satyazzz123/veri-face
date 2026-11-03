import React, { useRef } from 'react';
import { ImageRecord, ImageStatus } from '@image-val/shared';
import { ValidationBadge } from './ValidationBadge';
import { formatBytes, formatDate } from '../lib/utils';
import {
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  User,
  Hash,
  Maximize2,
  HardDrive,
  Clock,
  Layers,
} from 'lucide-react';

interface ImageDetailModalProps {
  image: ImageRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageDetailModal({ image, isOpen, onClose }: ImageDetailModalProps) {
  if (!isOpen || !image) return null;

  const previewUrl = image.signedProcessedUrl || image.signedOriginalUrl;
  const isAccepted = image.status === ImageStatus.ACCEPTED;
  const isRejected = image.status === ImageStatus.REJECTED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <ValidationBadge status={image.status} />
            <h3 className="text-base font-bold text-white truncate max-w-md" title={image.originalFilename}>
              {image.originalFilename}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Visual & Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Image Preview with Bounding Box Overlay */}
            <div className="relative aspect-square bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              {previewUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={previewUrl}
                    alt={image.originalFilename}
                    className="w-full h-full object-contain"
                  />

                  {/* SVG Overlay for Face Bounding Boxes */}
                  {image.faceBoundingBoxes &&
                    image.faceBoundingBoxes.length > 0 &&
                    image.width &&
                    image.height && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${image.width} ${image.height}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {image.faceBoundingBoxes.map((box, idx) => (
                          <g key={idx}>
                            <rect
                              x={box.x}
                              y={box.y}
                              width={box.width}
                              height={box.height}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth={Math.max(2, Math.round(image.width! / 250))}
                              strokeDasharray="4 2"
                            />
                            <text
                              x={box.x}
                              y={Math.max(20, box.y - 6)}
                              fill="#38bdf8"
                              fontSize={Math.max(14, Math.round(image.width! / 40))}
                              fontWeight="bold"
                            >
                              Face #1 ({(box.confidence * 100).toFixed(0)}%)
                            </text>
                          </g>
                        ))}
                      </svg>
                    )}
                </div>
              ) : (
                <div className="text-zinc-600 text-sm">Image preview unavailable</div>
              )}

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 transition"
                  title="Open original high-res preview"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Quick Summary Info */}
            <div className="space-y-4">
              {/* Acceptance / Rejection Banner */}
              {isAccepted && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-300">Validation Passed</h4>
                    <p className="text-xs text-emerald-400/80 mt-0.5">
                      The image successfully cleared all 15 biometric, resolution, blur, and integrity checks.
                    </p>
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-rose-300">Validation Rejected</h4>
                    <ul className="text-xs text-rose-300/90 list-disc list-inside mt-1.5 space-y-1">
                      {image.rejectionReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Key Properties Table */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 divide-y divide-zinc-800/80 text-xs">
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Status</span>
                  <span className="font-semibold text-white">{image.status}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">File Size</span>
                  <span className="font-semibold text-white font-mono">{formatBytes(image.fileSize)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Format (Decoded)</span>
                  <span className="font-semibold text-white font-mono uppercase">
                    {image.detectedFormat || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Resolution</span>
                  <span className="font-semibold text-white font-mono">
                    {image.width && image.height ? `${image.width} × ${image.height} px` : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Original MIME</span>
                  <span className="font-semibold text-white font-mono">{image.originalMimeType}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Uploaded At</span>
                  <span className="text-white">{formatDate(image.createdAt)}</span>
                </div>
                {image.processedAt && (
                  <div className="flex justify-between py-2">
                    <span className="text-zinc-400">Processed At</span>
                    <span className="text-white">{formatDate(image.processedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Granular Pipeline Stage Analysis */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Validation Stage Breakdown</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Blur Score Card */}
              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium">Laplacian Blur Score</span>
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {image.blurScore !== null ? image.blurScore : '—'}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Minimum threshold: 100 • {image.blurScore && image.blurScore >= 100 ? '✅ Sharp' : '⚠️ Blurry'}
                </p>
              </div>

              {/* Face Detection Card */}
              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium">Biometric Face Check</span>
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {image.faceCount !== null ? `${image.faceCount} Detected` : '—'}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Requires exactly 1 face • YuNet CNN detector
                </p>
              </div>

              {/* Perceptual Hash Card */}
              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Hash className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium">Perceptual Hash (pHash)</span>
                </div>
                <div className="text-sm font-bold text-white font-mono truncate" title={image.perceptualHash || ''}>
                  {image.perceptualHash || 'Pending'}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  64-bit DCT fingerprint • Hamming limit: 8
                </p>
              </div>
            </div>
          </div>

          {/* Storage & Object Keys */}
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 text-xs font-mono">
            <h5 className="text-xs font-bold font-sans text-zinc-300 mb-2 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-zinc-400" /> S3 / MinIO Object Storage Keys
            </h5>
            <div className="space-y-1.5 text-zinc-400">
              <div>
                <span className="text-zinc-500">Original Object Key: </span>
                <span className="text-zinc-200">{image.originalStorageKey}</span>
              </div>
              {image.processedStorageKey && (
                <div>
                  <span className="text-zinc-500">Processed Object Key: </span>
                  <span className="text-zinc-200">{image.processedStorageKey}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">ID: {image.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
