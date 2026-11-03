import React from 'react';
import { ImageStatus } from '@image-val/shared';
import { CheckCircle2, XCircle, Clock, AlertTriangle, UploadCloud, FileCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface ValidationBadgeProps {
  status: ImageStatus | string;
  className?: string;
  showIcon?: boolean;
}

export function ValidationBadge({ status, className, showIcon = true }: ValidationBadgeProps) {
  switch (status) {
    case ImageStatus.ACCEPTED:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
            className
          )}
        >
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          Accepted
        </span>
      );

    case ImageStatus.REJECTED:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30',
            className
          )}
        >
          {showIcon && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
          Rejected
        </span>
      );

    case ImageStatus.PROCESSING:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse',
            className
          )}
        >
          {showIcon && <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />}
          Processing
        </span>
      );

    case ImageStatus.UPLOADING:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30',
            className
          )}
        >
          {showIcon && <UploadCloud className="w-3.5 h-3.5 text-blue-300 animate-bounce" />}
          Uploading
        </span>
      );

    case ImageStatus.UPLOADED:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30',
            className
          )}
        >
          {showIcon && <FileCheck className="w-3.5 h-3.5 text-indigo-300" />}
          Uploaded
        </span>
      );

    case ImageStatus.FAILED:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-500/40',
            className
          )}
        >
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          Failed
        </span>
      );

    case ImageStatus.SELECTED:
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700',
            className
          )}
        >
          Selected
        </span>
      );
  }
}
