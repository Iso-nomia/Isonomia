'use client';
import * as React from 'react';
import type { Item } from '@/app/(root)/(standard)/discussions/ui/DiscussionsDashboard';
import { SubscribeButton } from './SubscribeButton';


export type DiscussionListItem = {
  id: string;
  title: string | null;
  description?: string | null;
  updatedAt: string;           // ISO string
  createdAt?: string;
  conversationId?: number | null;
  // Optional extras for future: linked entity, counts, badges, etc.
  status?: string | null;
};


// app/(root)/(standard)/discussions/ui/DiscussionsDashboard.tsx
// Replace the DiscussionCard function with this enhanced version:

export function DiscussionCard({
  item,
  index,
  mounted,
  showAuthor,
  currentUserId,
    showSubscribe = true, // NEW: control whether to show subscribe button

}: {
  item: Item;
  index: number;
  mounted: boolean;
  showAuthor?: boolean;
  currentUserId: string;
    showSubscribe?: boolean;

}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isOwner = item.createdById === currentUserId;

  return (
    <li
      className={`kb-edge backdrop-blur-md bg-white/50 group rounded-2xl px-2 py-1 shadow-md shadow-indigo-200 transition-all duration-100 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ transitionDelay: `${Math.min(index * 50, 300)}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Decorative gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br from-indigo-50/100 via-transparent to-rose-50/70 transition-opacity rounded-2xl duration-100 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />
      
      {/* Accent border that appears on hover */}
      <div className={`absolute left-0 top-0 h-full w-1 rounded-2xl bg-gradient-to-b from-transparent via-indigo-300/50 to-transparent transition-all duration-100 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />
   {/* Subscribe button (top-right corner) */}
      {showSubscribe && !isOwner && (
        <div className="absolute right-4 top-4 z-10">
          <SubscribeButton discussionId={item.id} variant="icon-only" />
        </div>
      )}
      <div className="relative p-6">
        {/* Header with Title & Engagement Stats */}
        <div className="mb-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="flex-1 text-lg font-semibold leading-snug text-slate-900 transition-colors line-clamp-2 group-hover:text-indigo-700">
              {item.title || 'Untitled Discussion'}
            </h3>
            
            {/* Reply count badge */}
            {(item.replyCount ?? 0) > 0 && (
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
                isHovered 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span className="text-xs font-semibold">{item.replyCount}</span>
              </div>
            )}
          </div>

          {/* Description Preview */}
          {item.description && (
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

{/* Metadata Bar */}
<div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
  {/* Time */}
  <div className="flex items-center gap-1.5">
    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="font-medium">{formatDate(item.updatedAt)}</span>
  </div>

  {/* Chat available indicator */}
  {/* {item.conversationId && (
    <>
      <span className="text-slate-300">•</span>
      <div className="flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
        <span className="font-medium text-indigo-700">Chat available</span>
      </div>
    </>
  )} */}

  {/* Owner badge */}
  {isOwner && (
    <>
      <span className="text-slate-300">•</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
        Owner
      </span>
    </>
  )}
</div>

        {/* Divider */}
        <div className="mb-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={`/discussions/${item.id}`}
            // className={`group/btn flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            //   isHovered
            //     ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-200'
            //     : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            // }`}
                      className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5 transition-all"

          >
            <svg 
              className={`h-4 w-4 transition-transform ${isHovered ? 'scale-110 ' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span>Join Discussion</span>
          </a>

          {isOwner && (
            <a
              href={`/discussions/${item.id}/edit`}
              className="group/settings flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2.5 btnv2 btnv2--sm text-slate-700 transition-all "
              title="Manage discussion"
            >
              <svg 
                className="h-4 w-4 transition-transform group-hover/settings:rotate-90" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

// Keep the existing formatDate function unchanged
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}