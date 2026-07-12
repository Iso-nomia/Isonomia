// Server Component
import { DB, getUserCtx, labelForAudience } from '@/app/api/_sheaf-acl-demo/_store';
import { visibleFacetsFor, defaultFacetFor } from '@app/sheaf-acl';

export const dynamic = 'force-dynamic'; // always render server-side

function FacetBadges({ labels }: { labels: string[] }) {
  if (labels.length === 0) return <span className="text-slate-500">none</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l, i) => (
        <span
          key={i}
          className="inline-block rounded-full border px-2 py-0.5 text-xs text-slate-700 bg-white/70"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

export default async function AdminSheafPage() {
  const users = Array.from(DB.users.values());
  const messages = Array.from(DB.messages.values()).sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Sheaf Admin — Per-User Visibility</h1>
      <p className="mt-2 text-sm text-slate-600">
        Each row shows what a given user can see. Single-facet viewers will not learn that other facets exist.
      </p>

      <div className="mt-6 space-y-6">
        {messages.map((m) => {
          return (
            <div key={m.id} className="rounded-xl border bg-white/70 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm text-slate-600">Message</div>
                  <div className="font-mono text-xs text-slate-700">{m.id}</div>
                </div>
                <div className="text-xs text-slate-600">
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-1 pr-3">User</th>
                    <th className="py-1 pr-3">Visible Facets</th>
                    <th className="py-1 pr-3">Default Facet</th>
                    <th className="py-1">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const ctx = getUserCtx(u.id);
                    const vis = visibleFacetsFor(ctx, m.facets);
                    const def = defaultFacetFor(ctx, m.facets);
                    const labels = vis.map(f => labelForAudience(f.audience));
                    const defLabel = def ? labelForAudience(def.audience) : '—';
                    const preview = def?.body && typeof (def.body as any).text === 'string'
                      ? (def.body as any).text
                      : '—';

                    return (
                      <tr key={u.id} className="border-t">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.id}</div>
                        </td>
                        <td className="py-2 pr-3"><FacetBadges labels={labels} /></td>
                        <td className="py-2 pr-3"><span className="text-slate-700">{defLabel}</span></td>
                        <td className="py-2">
                          <div className="truncate text-slate-700">{preview}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

            </div>
          );
        })}
      </div>
    </div>
  );
}
