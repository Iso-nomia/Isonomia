// app/(root)/(standard)/discussions/ui/DiscussionsDashboard.tsx
'use client';
import * as React from 'react';
import { NewDiscussionButton } from '@/components/discussion/NewDiscussionButton';
import { DiscussionCard } from '@/components/discussion/DiscussionCard';
import { Compass } from "@mynaui/icons-react";

export type Item = {
  id: string;
  title: string | null;
  description?: string | null;
  conversationId?: number | null;
  createdAt: string;
  updatedAt: string;
  status?: string | null;
  visibility?: string | null;
  attachedToType?: string | null;
  attachedToId?: string | null;
  replyCount?: number;
  createdById?: string;
};

type Tab = 'mine' | 'subscribed';

export default function DiscussionsDashboard({
  initialItems,
  initialNextCursor,
  pageSize,
  userId,
}: {
  initialItems: Item[];
  initialNextCursor: { updatedAt: string; id: string } | null;
  pageSize: number;
  userId: string;
}) {
  const [activeTab, setActiveTab] = React.useState<Tab>('mine');
  const [items, setItems] = React.useState<Item[]>(initialItems);
  const [cursor, setCursor] = React.useState(initialNextCursor);
  const [busy, setBusy] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reset items when tab changes
  React.useEffect(() => {
    async function loadTab() {
      setBusy(true);
      setError(null);
      try {
        const endpoint = activeTab === 'mine' 
          ? '/api/discussions/list'
          : '/api/discussions/subscribed';
        
        const u = new URL(endpoint, location.origin);
        u.searchParams.set('limit', String(pageSize));
        const r = await fetch(u.toString(), { cache: 'no-store' });
        
        if (!r.ok) {
          throw new Error(`Failed to load discussions: ${r.status} ${r.statusText}`);
        }
        
        const j = await r.json();
        setItems(j.items || []);
        setCursor(j.nextCursor ?? null);
      } catch (err) {
        console.error('Failed to load tab:', err);
        setError(err instanceof Error ? err.message : 'Failed to load discussions');
        setItems([]);
        setCursor(null);
      } finally {
        setBusy(false);
      }
    }
    
    // Only reload if switching to subscribed tab
    if (activeTab === 'subscribed') {
      loadTab();
    } else {
      // For 'mine' tab, use initial data
      setItems(initialItems);
      setCursor(initialNextCursor);
    }
  }, [activeTab, pageSize]); // Removed initialItems and initialNextCursor from deps

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setError(null);
    try {
      const endpoint = activeTab === 'mine'
        ? '/api/discussions/list'
        : '/api/discussions/subscribed';
      
      const u = new URL(endpoint, location.origin);
      u.searchParams.set('limit', String(pageSize));
      u.searchParams.set('cursorUpdatedAt', cursor.updatedAt);
      u.searchParams.set('cursorId', cursor.id);
      const r = await fetch(u.toString(), { cache: 'no-store' });
      
      if (!r.ok) {
        throw new Error(`Failed to load more: ${r.status} ${r.statusText}`);
      }
      
      const j = await r.json();
      setItems((prev) => [...prev, ...j.items]);
      setCursor(j.nextCursor ?? null);
    } catch (err) {
      console.error('Failed to load more:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more discussions');
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-0 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header
          className={`mb-8 transition-all duration-500 ${
            mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="mb-1.5 text-2xl font-medium tracking-tight text-slate-800">
                My Discussions
              </h1>
              <p className="text-sm text-slate-500">
                {isEmpty ? (
                  activeTab === 'mine' 
                    ? 'Start your first discussion'
                    : 'Subscribe to discussions to see them here'
                ) : (
                  <>
                    {items.length} {items.length === 1 ? 'discussion' : 'discussions'}
                    {items.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-slate-400">
                          Updated {formatDate(items[0].updatedAt)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
            <div
              className={`flex gap-4 transition-all duration-300 delay-100 ${
                mounted ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
              }`}
            >
              <a
                href="/discussions/explore"
                className="btnv2 btnv2--sm rounded-xl flex align-center items-center gap-1.5"
              >
                <Compass className="flex w-4 h-4" /> 
                <span className="flex align-center text-sm text-center items-center gap-1.5">
                Explore
                </span>
              </a>
              <NewDiscussionButton />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('mine')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'mine'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Discussions
            </button>
            <button
              onClick={() => setActiveTab('subscribed')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'subscribed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subscribed
            </button>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error loading discussions</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {busy && items.length === 0 ? (
          <div className="flex justify-center py-16">
            <span className="kb-spinner" />
          </div>
        ) : isEmpty ? (
          /* Empty State */
          <EmptyState activeTab={activeTab} mounted={mounted} />
        ) : (
          /* Grid */
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
              <DiscussionCard
                key={item.id}
                item={item}
                index={idx}
                mounted={mounted}
                showAuthor={activeTab === 'subscribed'}
                currentUserId={userId}
                  showSubscribe={true} // Don't show in personal dashboard

              />
            ))}
          </ul>
        )}

        {/* Load More Section */}
        {cursor && !error && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadMore}
              disabled={busy}
              className="btnv2 transition-all duration-200"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="kb-spinner" />
                  Loading…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Load more
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        )}

        {!cursor && items.length > 0 && !error && (
          <div className="mt-8 text-center">
            <div className="kb-divider mb-4" />
            <p className="text-xs text-slate-400">All discussions loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ activeTab, mounted }: { activeTab: Tab; mounted: boolean }) {
  return (
    <div
      className={`postcard transition-all duration-500 delay-200 ${
        mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}
    >
      <div className="flex flex-col items-center justify-center rounded-2xl p-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100/50 to-rose-100/50">
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
        </div>
        <h3 className="mb-2 text-base font-medium text-slate-700">
          {activeTab === 'mine' ? 'No discussions yet' : 'No subscriptions yet'}
        </h3>
        <p className="mb-8 max-w-sm text-sm text-slate-500">
          {activeTab === 'mine'
            ? 'Start a conversation and collaborate with your community'
            : 'Explore discussions and subscribe to ones that interest you'}
        </p>
        {activeTab === 'mine' ? (
          <NewDiscussionButton />
        ) : (
          <a href="/discussions/explore" className="btnv2">
            Explore Discussions
          </a>
        )}
      </div>
    </div>
  );
}

function DiscussionCardLegacy({
  item,
  index,
  mounted,
  showAuthor,
  currentUserId,
}: {
  item: Item;
  index: number;
  mounted: boolean;
  showAuthor?: boolean;
  currentUserId: string;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isOwner = item.createdById === currentUserId;

  return (
    <li
      className={`kb-edge backdrop-blur-md bg-white/50 group rounded-2xl p-5 shadow-md shadow-indigo-200 transition-all duration-100 ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ transitionDelay: `${Math.min(index * 50, 300)}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with Title */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex-1 truncate text-base font-medium text-slate-800 transition-colors group-hover:text-slate-900">
          {item.title || 'Untitled Discussion'}
        </h3>
      </div>

      {/* Description Preview */}
      {item.description && (
        <p className="mb-3 line-clamp-2 text-xs text-slate-600 leading-relaxed">
          {item.description}
        </p>
      )}

      {/* Metadata */}
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Updated {formatDate(item.updatedAt)}</span>
        </div>

        {/* Engagement Stats */}
        <div className="flex flex-wrap gap-1.5">
          {(item.replyCount ?? 0) > 0 && (
            <span className="kb-badge kb-badge--draft">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          )}
          {item.conversationId && (
            <span className="kb-badge kb-badge--draft">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              Active chat
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <a
          href={`/discussions/${item.id}`}
          className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5 transition-all"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${isHovered ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          Join
        </a>
        {isOwner && (
          <a
            href={`/discussions/${item.id}/edit`}
            className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5 transition-all"
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${isHovered ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage
          </a>
        )}
      </div>
    </li>
  );
}

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