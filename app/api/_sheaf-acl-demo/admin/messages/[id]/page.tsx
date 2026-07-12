import { notFound } from 'next/navigation';
import { DB, getUserCtx, labelForAudience } from '@/app/api/_sheaf-acl-demo/_store';
import { visibleFacetsFor } from '@app/sheaf-acl';

export default function MessageAdminPage({ params }: { params: { id: string } }) {
  const msg = DB.messages.get(params.id);
  if (!msg) return notFound();

  const users = Array.from(DB.users.values());

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold">Message {msg.id}</h1>
      <div className="mt-4 space-y-6">
        {users.map(u => {
          const ctx = getUserCtx(u.id);
          const vis = visibleFacetsFor(ctx, msg.facets);

          return (
            <div key={u.id} className="rounded-lg border bg-white/70 p-4">
              <div className="mb-2 text-sm text-slate-600">
                <span className="font-medium">{u.name}</span> sees {vis.length} facet{vis.length===1?'':'s'}:
              </div>
              {vis.map(f => (
                <div key={f.id} className="mb-3 rounded border bg-white p-3">
                  <div className="text-xs text-slate-500">{labelForAudience(f.audience)}</div>
                  <div className="mt-1 text-slate-800">
                    {typeof (f.body as any).text === 'string' ? (f.body as any).text : JSON.stringify(f.body)}
                  </div>
                </div>
              ))}
              {vis.length === 0 && <div className="text-slate-500">No facets visible</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
