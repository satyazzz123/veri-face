import React from 'react';
import { ShieldCheck, Radio, BookOpen, Layers } from 'lucide-react';

interface HeaderProps {
  isSSEConnected: boolean;
}

export function Header({ isSSEConnected }: HeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">VeriFace</h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v1.0 Pro
              </span>
            </div>
            <p className="text-xs text-zinc-400">Enterprise Image Upload & Multi-Stage Validation Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Real-time SSE indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <Radio
              className={`w-3.5 h-3.5 ${
                isSSEConnected ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'
              }`}
            />
            <span className="hidden sm:inline">
              {isSSEConnected ? 'Live Updates Active' : 'Connecting Stream...'}
            </span>
          </div>

          {/* Swagger link */}
          <a
            href="http://localhost:4000/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700 transition"
          >
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">OpenAPI Docs</span>
          </a>
        </div>
      </div>
    </header>
  );
}
