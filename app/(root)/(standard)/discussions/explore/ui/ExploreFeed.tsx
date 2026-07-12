// app/(root)/(standard)/discussions/explore/ui/ExploreFeed.tsx
'use client';
import * as React from 'react';
import { SubscribeButton } from '@/components/discussion/SubscribeButton';

type Item = {
  id: string;
  title: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  replyCount?: number;
  viewCount?: number;
  createdById: string;
};

type SortOption = 'hot' | 'new' | 'top';

export default function ExploreFeed({
  initialItems,
  currentUserId,
  hasMore: initialHasMore,
}: {
  initialItems: Item[];
  currentUserId: string;
  hasMore: boolean;
}) {
  const [items, setItems] = React.useState<Item[]>(initialItems);
  const [cursor, setCursor] = React.useState(initialHasMore ? '20' : null);
  const [sort, setSort] = React.useState<SortOption>('hot');
  const [busy, setBusy] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reload when sort changes
  React.useEffect(() => {
    async function loadSort() {
      setBusy(true);
      try {
        const u = new URL('/api/discussions/explore', location.origin);
        u.searchParams.set('limit', '20');
        u.searchParams.set('sort', sort);
        const r = await fetch(u.toString());
        const j = await r.json();
        setItems(j.items || []);
        setCursor(j.nextCursor);
      } finally {
        setBusy(false);
      }
    }
    if (sort !== 'hot') loadSort(); // hot is initial
  }, [sort]);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const u = new URL('/api/discussions/explore', location.origin);
      u.searchParams.set('limit', '20');
      u.searchParams.set('cursor', cursor);
      u.searchParams.set('sort', sort);
      const r = await fetch(u.toString());
      const j = await r.json();
      setItems((prev) => [...prev, ...(j.items || [])]);
      setCursor(j.nextCursor);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-5xl py-8">
        {/* Header */}
        <header
          className={`mb-6 transition-all duration-500 ${
            mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
        >
          <div className="mb-4">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
              Explore Discussions
            </h1>
            <p className="text-sm text-slate-600">
              Discover and join conversations from across the platform
            </p>
          </div>

          {/* Sort Pills */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Sort by:</span>
            {(['hot', 'new', 'top'] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setSort(option)}
                disabled={busy}
                className={`relative rounded-xl px-4 py-1 text-sm font-semibold btnv2 transition-all ${
                  sort === option
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-white/80 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {option === 'hot' && (
                  <span className="flex items-center gap-1.5">
                    Hot
                  </span>
                )}
                {option === 'new' && (
                  <span className="flex items-center gap-1.5">
                    New
                  </span>
                )}
                {option === 'top' && (
                  <span className="flex items-center gap-1.5">
                    Top
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Feed */}
        {busy && items.length === 0 ? (
          <div className="flex justify-center py-16">
            <span className="kb-spinner" />
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <ExploreCard
                key={item.id}
                item={item}
                index={idx}
                mounted={mounted}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {cursor && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={busy}
              className="rounded-full bg-white border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="kb-spinner h-4 w-4" />
                  Loading…
                </span>
              ) : (
                'Load more discussions'
              )}
            </button>
          </div>
        )}

        {!cursor && items.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">You've reached the end!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Reddit-style ExploreCard
function ExploreCard({
  item,
  index,
  mounted,
  currentUserId,
}: {
  item: Item;
  index: number;
  mounted: boolean;
  currentUserId: string;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isOwner = item.createdById === currentUserId;

  return (
    
    <article
      className={`group flex gap-2 rounded-2xl border border-slate-200 bg-white/40 backdrop-blur-xl 
         transition-all hover:border-slate-300 hover:shadow-md ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ transitionDelay: `${Math.min(index * 20, 200)}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left: Engagement Column */}
      <div className="flex w-16 flex-col items-center gap-1 rounded-l-xl bg-transparent py-4 border-r border-slate-300 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-lg font-bold text-slate-800">{item.replyCount ?? 0}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {item.replyCount === 1 ? 'reply' : 'replies'}
          </div>
        </div>
        {(item.viewCount ?? 0) > 0 && (
          <div className="mt-2 flex flex-col items-center gap-0.5 text-[10px]">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-slate-600">{item.viewCount}</span>
          </div>
        )}
      </div>

      {/* Right: Content */}
      <div className="flex flex-1 flex-col gap-2 py-3 pr-4 min-w-0">
        {/* Title & Meta */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <a
              href={`/discussions/${item.id}`}
              className="flex-1 min-w-0 group/title"
            >
              <h2 className="text-base font-semibold leading-snug text-slate-900 line-clamp-2 group-hover/title:text-indigo-600 transition-colors">
                {item.title || 'Untitled Discussion'}
              </h2>
            </a>
            
            {/* Subscribe Button */}
            {!isOwner && (
              <div className={`transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                <SubscribeButton discussionId={item.id} variant="text-only" />
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Footer Meta */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
          {/* Time */}
          <div className="flex items-center gap-1">
            <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{formatDate(item.lastActiveAt)}</span>
          </div>

          <span className="text-slate-300">•</span>

          {/* Owner Badge */}
          {isOwner && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Your discussion
              </span>
              <span className="text-slate-300">•</span>
            </>
          )}

          {/* Action Buttons - Appear on Hover */}
          <div
            className={`ml-auto flex items-center gap-2 transition-opacity ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <a
              href={`/discussions/${item.id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white btnv2 hover:bg-indigo-800 transition-all"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              Join
            </a>
            {isOwner && (
              <a
                href={`/discussions/${item.id}/edit`}
                className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-1.5 btnv2 text-slate-600 hover:bg-slate-200 transition-all"
                title="Manage discussion"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// function formatDate(isoString: string): string {
//   const date = new Date(isoString);
//   const now = new Date();
//   const diffMs = now.getTime() - date.getTime();
//   const diffMins = Math.floor(diffMs / 60000);
//   const diffHours = Math.floor(diffMs / 3600000);
//   const diffDays = Math.floor(diffMs / 86400000);

//   if (diffMins < 1) return 'just now';
//   if (diffMins < 60) return `${diffMins}m ago`;
//   if (diffHours < 24) return `${diffHours}h ago`;
//   if (diffDays < 7) return `${diffDays}d ago`;

//   return date.toLocaleDateString('en-US', {
//     month: 'short',
//     day: 'numeric',
//     year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
//   });
// }

function formatDate(isoString: string | undefined): string {
  if (!isoString) return 'recently';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'recently';
    
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
  } catch (e) {
    return 'recently';
  }
}