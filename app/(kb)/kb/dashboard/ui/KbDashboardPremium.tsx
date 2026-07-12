'use client';
import * as React from 'react';
import { NewKbButton } from '@/components/kb/NewKbButton';

type Item = {
  id: string;
  title: string | null;
  spaceId: string;
  createdAt: string;
  updatedAt: string;
  status?: string | null;
  visibility?: string | null;
};

export default function KbDashboard({
  initialItems,
  initialNextCursor,
  pageSize,
}: {
  initialItems: Item[];
  initialNextCursor: { updatedAt: string; id: string } | null;
  pageSize: number;
}) {
  const [items, setItems] = React.useState<Item[]>(initialItems);
  const [cursor, setCursor] = React.useState(initialNextCursor);
  const [busy, setBusy] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setBusy(true);
    const u = new URL('/api/kb/pages/list', location.origin);
    u.searchParams.set('limit', String(pageSize));
    u.searchParams.set('cursorUpdatedAt', cursor.updatedAt);
    u.searchParams.set('cursorId', cursor.id);
    const r = await fetch(u.toString(), { cache: 'no-store' });
    const j = await r.json();
    setItems((prev) => [...prev, ...j.items]);
    setCursor(j.nextCursor ?? null);
    setBusy(false);
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
                Knowledge Base Dashboard
              </h1>
              <p className="text-sm text-slate-500">
                {isEmpty ? (
                  'Create your first knowledge base'
                ) : (
                  <>
                    {items.length} {items.length === 1 ? 'page' : 'pages'}
                    {' · '}
                    <span className="text-slate-400">
                      Updated {formatDate(items[0].updatedAt)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div
              className={`transition-all duration-300 delay-100 ${
                mounted ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
              }`}
            >
              <NewKbButton />
            </div>
          </div>
        </header>

        {/* Empty State */}
        {isEmpty ? (
          <div
            className={`postcard transition-all duration-500 delay-200 ${
              mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <div className="flex flex-col items-center justify-center rounded-2xl p-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100/50 to-rose-100/50">
                <svg
                  className="h-10 w-10 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-base font-medium text-slate-700">
                No knowledge bases yet
              </h3>
              <p className="mb-8 max-w-sm text-sm text-slate-500">
                Start building your knowledge repository by creating your first page
              </p>
              <NewKbButton />
            </div>
          </div>
        ) : (
          /* Grid */
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
              <KbCard key={item.id} item={item} index={idx} mounted={mounted} />
            ))}
          </ul>
        )}

        {/* Load More Section */}
        {cursor && (
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
                  <svg
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              )}
            </button>
          </div>
        )}

        {!cursor && items.length > 0 && (
          <div className="mt-8 text-center">
            <div className="kb-divider mb-4" />
            <p className="text-xs text-slate-400">All pages loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KbCard({
  item,
  index,
  mounted,
}: {
  item: Item;
  index: number;
  mounted: boolean;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <li
      className={`kb-edge  backdrop-blur-md bg-white/50 group rounded-2xl p-5 shadow-md shadow-indigo-200  transition-all duration-100 ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ transitionDelay: `${Math.min(index * 50, 300)}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with Title */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex-1 truncate text-base font-medium text-slate-800 transition-colors group-hover:text-slate-900">
          {item.title || 'Untitled'}
        </h3>
        {item.visibility && (
          <span className="shrink-0 text-[10px] text-slate-600">
            {getVisibilityIcon(item.visibility)}
          </span>
        )}
      </div>

      {/* Metadata */}
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <svg
            className="h-3 w-3 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Updated {formatDate(item.updatedAt)}</span>
        </div>
        {item.status && (
          <div>
            <span className={`kb-badge kb-badge--${item.status.toLowerCase()}`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              {item.status}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <a
          href={`/kb/pages/${item.id}/view`}
          className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5 transition-all"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          View
        </a>
        <a
          href={`/kb/pages/${item.id}/edit`}
          className="btnv2 btnv2--sm group/btn flex flex-1 items-center justify-center gap-1.5 transition-all"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
            />
          </svg>
          Edit
        </a>
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

function getVisibilityIcon(visibility: string): string {
  const icons: Record<string, string> = {
    public: '𒓣',
    private: '𒃯',
    unlisted: '𒃶',
  };
  return icons[visibility.toLowerCase()] || '';
}