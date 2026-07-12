'use client';
import * as React from 'react';

import type { WorkItem } from '@/app/(root)/(standard)/works/ui/WorksDashboard';

export function WorkCard({
  item,
  index,
  mounted,
  isOwner,
}: {
  item: WorkItem;
  index: number;
  mounted: boolean;
  isOwner?: boolean;
}) {
  const [hover, setHover] = React.useState(false);

  return (
    <li
      className={`kb-edge backdrop-blur-md bg-white/50 group rounded-2xl p-5 shadow-md shadow-indigo-200 transition-all duration-100 ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ transitionDelay: `${Math.min(index * 50, 300)}ms` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex-1 truncate text-base font-medium text-slate-800 group-hover:text-slate-900">
          {item.title || 'Untitled Work'}
        </h3>
        {item.theoryType && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100">
            {item.theoryType}
          </span>
        )}
      </div>

      <div className="mb-4 space-y-1.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Created {new Date(item.createdAt).toLocaleString()}</span>
        </div>
        {item.deliberationId && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
            <span className="text-slate-500">Delib {item.deliberationId.slice(0, 8)}…</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <a
          href={`/works/${item.id}`}
          className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${hover ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          Open
        </a>

        {isOwner && (
          <a
            href={`/works/${item.id}#manage`}
            className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5"
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${hover ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L7.5 21H3v-4.5L16.732 3.732z" />
            </svg>
            Manage
          </a>
        )}
      </div>
    </li>
  );
}
