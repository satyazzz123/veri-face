import React from 'react';
import { ImageRecord, ImageStatus } from '@image-val/shared';
import { Layers, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface StatsOverviewProps {
  images: ImageRecord[];
}

export function StatsOverview({ images }: StatsOverviewProps) {
  const total = images.length;
  const accepted = images.filter((img) => img.status === ImageStatus.ACCEPTED).length;
  const rejected = images.filter((img) => img.status === ImageStatus.REJECTED).length;
  const processing = images.filter((img) => img.status === ImageStatus.PROCESSING).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-400">Total Uploads</p>
          <p className="text-2xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
          <Layers className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-emerald-900/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-emerald-400">Accepted</p>
          <p className="text-2xl font-bold text-white mt-1">{accepted}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-rose-900/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-rose-400">Rejected</p>
          <p className="text-2xl font-bold text-white mt-1">{rejected}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <XCircle className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-amber-900/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-amber-300">In Pipeline</p>
          <p className="text-2xl font-bold text-white mt-1">{processing}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Clock className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
