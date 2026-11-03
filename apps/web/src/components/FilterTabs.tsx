import React from 'react';
import { FilterStatus } from '../types';
import { ImageStatus } from '@image-val/shared';
import { Search, Layers, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface FilterTabsProps {
  currentFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function FilterTabs({
  currentFilter,
  onFilterChange,
  search,
  onSearchChange,
}: FilterTabsProps) {
  const tabs = [
    { id: 'ALL' as FilterStatus, label: 'All Images', icon: Layers },
    { id: ImageStatus.ACCEPTED as FilterStatus, label: 'Accepted', icon: CheckCircle2 },
    { id: ImageStatus.REJECTED as FilterStatus, label: 'Rejected', icon: XCircle },
    { id: ImageStatus.PROCESSING as FilterStatus, label: 'Processing', icon: Clock },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      {/* Filter Buttons */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap',
                isActive
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-blue-400' : 'text-zinc-500')} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative min-w-[240px] max-w-sm">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by filename..."
          className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition"
        />
      </div>
    </div>
  );
}
