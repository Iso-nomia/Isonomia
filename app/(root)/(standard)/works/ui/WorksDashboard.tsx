'use client';
import * as React from 'react';
import { NewWorkButton } from '@/components/work/NewWorkButton';
import { WorkCard } from '@/components/work/WorkCard';

export type WorkItem = {
  id: string;
  title: string;
  theoryType: 'DN' | 'IH' | 'TC' | 'OP' | null;
  createdAt: string;
  deliberationId: string | null;
  createdById: string | null;
};

export type WorkItemCursor = { createdAt: string; id: string };

type Tab = 'mine' | 'deliberation';
type TheoryType = 'DN' | 'IH' | 'TC' | 'OP';


export default function WorksDashboard({
  initialItems,
  initialNextCursor,
  pageSize,
  userId,
  deliberationId,
}: {
  initialItems: WorkItem[];
  initialNextCursor: WorkItemCursor | null;
  pageSize: number;
  userId: string;
  deliberationId: string | null;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>('mine');
  const [items, setItems] = React.useState<WorkItem[]>(initialItems);
  const [cursor, setCursor] = React.useState<WorkItemCursor | null>(initialNextCursor);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

    const [newType, setNewType] = React.useState<TheoryType>('IH');


  React.useEffect(() => setMounted(true), []);

  // When switching to deliberation tab, load fresh; 'mine' uses initial SSR data
  React.useEffect(() => {
    async function loadDelibTab() {
      if (!deliberationId) return;
      setBusy(true); setError(null);
      try {
        const u = new URL('/api/works/list', location.origin);
        u.searchParams.set('limit', String(pageSize));
        u.searchParams.set('scope', 'deliberation');
        u.searchParams.set('deliberationId', deliberationId);
        const r = await fetch(u.toString(), { cache: 'no-store' });
        if (!r.ok) throw new Error(`Failed to load works: ${r.status} ${r.statusText}`);
        const j = await r.json();
        setItems(j.items || []);
        setCursor(j.nextCursor ?? null);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load works');
        setItems([]); setCursor(null);
      } finally {
        setBusy(false);
      }
    }

    if (activeTab === 'deliberation') {
      loadDelibTab();
    } else {
      setItems(initialItems);
      setCursor(initialNextCursor);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pageSize, deliberationId]);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true); setError(null);
    try {
      const u = new URL('/api/works/list', location.origin);
      u.searchParams.set('limit', String(pageSize));
      if (activeTab === 'deliberation') {
        u.searchParams.set('scope', 'deliberation');
        if (deliberationId) u.searchParams.set('deliberationId', deliberationId);
      } else {
        u.searchParams.set('scope', 'mine');
      }
      u.searchParams.set('cursorCreatedAt', cursor.createdAt);
      u.searchParams.set('cursorId', cursor.id);

      const r = await fetch(u.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error(`Failed to load more: ${r.status} ${r.statusText}`);
      const j = await r.json();
      setItems(prev => [...prev, ...(j.items || [])]);
      setCursor(j.nextCursor ?? null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load more works');
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = items.length === 0;

  

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-0 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className={`mb-8 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="mb-1.5 text-2xl font-medium tracking-tight text-slate-800">
                My Works
              </h1>
              <p className="text-sm text-slate-500">
                {isEmpty ? (
                  activeTab === 'mine'
                    ? 'Create your first structured work'
                    : 'No works found for this deliberation'
                ) : (
                  <>
                    {items.length} {items.length === 1 ? 'work' : 'works'}
                    {items.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-slate-400">
                          Newest {formatDate(items[0].createdAt)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>


            {/* Actions: Explore + New Work (routes to /works/new with query) */}
            <div className={`flex items-center gap-3 transition-all duration-300 delay-100 ${mounted ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`}>
              {/* Tiny theory-type picker feeding the NewWorkButton */}
              <select
                aria-label="New work type"
                className="border rounded px-2 py-1 text-xs bg-white"
                value={newType}
                onChange={(e)=>setNewType(e.target.value as TheoryType)}
              >
                <option value="IH">IH</option>
                <option value="TC">TC</option>
                <option value="DN">DN</option>
                <option value="OP">OP</option>
              </select>
              <a href="/works/explore" className="btnv2 bg-white/50 flex items-center gap-2 text-sm px-3 py-3 rounded-xl
items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z"/></svg>
                <span className="text-sm">Explore</span>
              </a>

              <NewWorkButton
                theoryType={newType}
                deliberationId={activeTab === 'deliberation' ? deliberationId ?? undefined : undefined}
                className="whitespace-nowrap"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('mine')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Works
            </button>
            <button
              onClick={() => setActiveTab('deliberation')}
              disabled={!deliberationId}
              title={deliberationId ? '' : 'Open from a deep dive to enable this'}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'deliberation'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              } ${!deliberationId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {deliberationId ? `Deliberation ${shortId(deliberationId)}` : 'Deliberation'}
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error loading works</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Empty / Grid */}
        {busy && items.length === 0 ? (
          <div className="flex justify-center py-16"><span className="kb-spinner" /></div>
        ) : isEmpty ? (
          <EmptyState mounted={mounted} activeTab={activeTab} deliberationId={deliberationId} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
              <WorkCard
                key={item.id}
                item={item}
                index={idx}
                mounted={mounted}
                isOwner={item.createdById === userId}
              />
            ))}
          </ul>
        )}

        {/* Load More */}
        {cursor && !error && (
          <div className="mt-8 flex justify-center">
            <button onClick={loadMore} disabled={busy} className="btnv2 transition-all duration-200">
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="kb-spinner" /> Loading…
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
            <p className="text-xs text-slate-400">All works loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  activeTab,
  mounted,
  deliberationId,
}: {
  activeTab: Tab;
  mounted: boolean;
  deliberationId: string | null;
}) {
  // Default new-type for empty-state CTA (tweak if you prefer a different default)
  const defaultType: TheoryType = 'IH';

  return (
    <div className={`postcard transition-all duration-500 delay-200 ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
      <div className="flex flex-col items-center justify-center rounded-2xl p-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100/50 to-rose-100/50">
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mb-2 text-base font-medium text-slate-700">
          {activeTab === 'mine' ? 'No works yet' : 'No works in this deliberation'}
        </h3>
        <p className="mb-8 max-w-sm text-sm text-slate-500">
          {activeTab === 'mine'
            ? 'Create a work to frame, compare, and evaluate theories'
            : 'Switch tabs or create a new work attached to this deliberation'}
        </p>

        {/* Route-based creator (passes deliberationId when on that tab) */}
        <NewWorkButton
          theoryType={defaultType}
          deliberationId={activeTab === 'deliberation' ? deliberationId ?? undefined : undefined}
        />
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs  = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function shortId(id: string) {
  return id.length > 6 ? id.slice(0, 6) + '…' : id;
}

export type { WorkItem as Item };
