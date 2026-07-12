// //app/(kb)/kb/dashboard/ui/KbDashboard.tsx
// 'use client';
// import * as React from 'react';
// import { NewKbButton } from '@/components/kb/NewKbButton';

// type Item = {
//   id:string; title:string|null; spaceId:string;
//   createdAt:string; updatedAt:string; status?:string|null;
// };
// export default function KbDashboard({
//   initialItems, initialNextCursor, pageSize
// }: {
//   initialItems: Item[];
//   initialNextCursor: { updatedAt:string; id:string } | null;
//   pageSize: number;
// }) {
//   const [items, setItems] = React.useState<Item[]>(initialItems);
//   const [cursor, setCursor] = React.useState(initialNextCursor);
//   const [busy, setBusy] = React.useState(false);

//   async function loadMore() {
//     if (!cursor) return;
//     setBusy(true);
//     const u = new URL('/api/kb/pages/list', location.origin);
//     u.searchParams.set('limit', String(pageSize));
//     u.searchParams.set('cursorUpdatedAt', cursor.updatedAt);
//     u.searchParams.set('cursorId', cursor.id);
//     const r = await fetch(u.toString(), { cache: 'no-store' });
//     const j = await r.json();
//     setItems(prev => [...prev, ...j.items]);
//     setCursor(j.nextCursor ?? null);
//     setBusy(false);
//   }

//   return (
//     <div className="mx-auto max-w-4xl p-4">
//       <div className="mb-4 flex items-center justify-between">
//         <h1 className="text-base font-semibold">Your Knowledge Bases</h1>
//         <NewKbButton />
//       </div>

//       <ul className="grid gap-3 sm:grid-cols-2">
//         {items.map(x => (
//           <li key={x.id} className="rounded border bg-white p-3">
//             <div className="text-sm font-medium truncate">{x.title || 'Untitled'}</div>
//             <div className="text-[11px] text-slate-600">
//               updated {new Date(x.updatedAt).toLocaleString()}
//               {x.status && <> • {x.status}</>}
//             </div>
//             <div className="mt-2 flex gap-2 text-sm">
//               <a className="rounded border px-2 py-1 hover:bg-slate-50" href={`/kb/pages/${x.id}/view`}>view</a>
//               <a className="rounded border px-2 py-1 hover:bg-slate-50" href={`/kb/pages/${x.id}/edit`}>edit</a>
//             </div>
//           </li>
//         ))}
//       </ul>

//       <div className="mt-4">
//         {cursor ? (
//           <button onClick={loadMore} disabled={busy}
//                   className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">
//             {busy ? 'Loading…' : 'Load more'}
//           </button>
//         ) : (
//           <div className="text-[12px] text-slate-500">No more pages.</div>
//         )}
//       </div>
//     </div>
//   );
// }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/30 via-white to-rose-50/30">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-slate-800">
              Knowledge Bases
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {items.length} {items.length === 1 ? 'page' : 'pages'}
            </p>
          </div>
          <NewKbButton />
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="postcard flex flex-col items-center justify-center rounded-2xl p-12 text-center">
            <div className="mb-4 text-5xl opacity-20">📚</div>
            <h3 className="mb-2 text-base font-medium text-slate-700">
              No knowledge bases yet
            </h3>
            <p className="mb-6 text-sm text-slate-500">
              Create your first knowledge base to get started
            </p>
            <NewKbButton />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((x) => (
              <li
                key={x.id}
                className="group postcard rounded-2xl p-5 transition-all duration-200 hover:shadow-lg"
              >
                {/* Title */}
                <h3 className="mb-3 truncate text-base font-medium text-slate-800">
                  {x.title || 'Untitled'}
                </h3>

                {/* Metadata */}
                <div className="mb-4 space-y-1">
                  <div className="text-xs text-slate-500">
                    Updated {formatDate(x.updatedAt)}
                  </div>
                  {x.status && (
                    <div className="inline-flex items-center rounded-full bg-indigo-100/50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                      {x.status}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <a
                    href={`/kb/pages/${x.id}/view`}
                    className="btnv2 btnv2--sm flex-1 text-center"
                  >
                    View
                  </a>
                  <a
                    href={`/kb/pages/${x.id}/edit`}
                    className="btnv2 btnv2--sm flex-1 text-center"
                  >
                    Edit
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Load More */}
        {cursor && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadMore}
              disabled={busy}
              className="btnv2"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading…
                </span>
              ) : (
                'Load more'
              )}
            </button>
          </div>
        )}

        {!cursor && items.length > 0 && (
          <div className="mt-8 text-center text-xs text-slate-400">
            All pages loaded
          </div>
        )}
      </div>
    </div>
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