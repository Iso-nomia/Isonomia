// Server Component
import { prisma } from '@/app/api/sheaf/_prisma';
import { toAclFacet, userCtxFrom } from '@/app/api/sheaf/_map';
import { visibleFacetsFor, defaultFacetFor } from '@app/sheaf-acl';
import React from 'react';

export const dynamic = 'force-dynamic';

function FacetBadges({ labels }: { labels: string[] }) {
  if (labels.length === 0) return <span className="text-slate-500">none</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l, i) => (
        <span key={i} className="inline-block rounded-full border px-2 py-0.5 text-xs bg-white/70 text-slate-700">
          {l}
        </span>
      ))}
    </div>
  );
}

export default async function SheafAdminPage() {
  // Pick a small cohort to display (e.g., last 3 created users)
  const users = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
    take: 3,
    select: { id: true, username: true, name: true },
  });

  const messages = await prisma.message.findMany({
    orderBy: { created_at: 'desc' },
    take: 20,
    select: { id: true, created_at: true, sender_id: true },
  });

  const messageIds = messages.map(m => m.id);
  const facets = await prisma.sheafFacet.findMany({ where: { messageId: { in: messageIds } } });

  // Preload dynamic lists referenced
  const listIds = Array.from(new Set(facets.map(f => f.audienceListId).filter(Boolean))) as string[];
  const lists = new Map((await prisma.sheafAudienceList.findMany({ where: { id: { in: listIds } } }))
    .map(l => [l.id, l]));

  // Preload viewer roles (global roles)
  const userRoles = await prisma.userRole.findMany({ where: { userId: { in: users.map(u => u.id) } } });
  const rolesByUser = new Map<string, string[]>();
  for (const u of users) rolesByUser.set(u.id.toString(), []);
  for (const r of userRoles) {
    const arr = rolesByUser.get(r.userId.toString())!;
    arr.push(r.role);
  }

  // Group facets by message
  const fByMsg = new Map<string, typeof facets>();
  for (const f of facets) {
    const key = f.messageId.toString();
    if (!fByMsg.has(key)) fByMsg.set(key, []);
    fByMsg.get(key)!.push(f);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Sheaf Admin — Per-User Visibility</h1>
      <div className="mt-6 space-y-6">
        {messages.map((m) => {
          const fs = (fByMsg.get(m.id.toString()) ?? []).map(toAclFacet);
          if (fs.length === 0) return null;

          return (
            <div key={m.id.toString()} className="rounded-xl border bg-white/70 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm text-slate-600">Message</div>
                  <div className="font-mono text-xs text-slate-700">{m.id.toString()}</div>
                </div>
                <div className="text-xs text-slate-600">{new Date(m.created_at).toLocaleString()}</div>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-1 pr-3">User</th>
                    <th className="py-1 pr-3">Visible Facets</th>
                    <th className="py-1 pr-3">Default</th>
                    <th className="py-1">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const ctx = userCtxFrom(
                      { id: u.id, auth_id: '', created_at: new Date(), updated_at: null, username: u.username, name: u.name } as any,
                      rolesByUser.get(u.id.toString()) ?? [],
                      lists
                    );
                    const vis = visibleFacetsFor(ctx, fs);
                    const def = defaultFacetFor(ctx, fs);
                    const labels = vis.map((f) => {
                      switch (f.audience.kind) {
                        case 'EVERYONE': return 'Public';
                        case 'ROLE': return `Role:${f.audience.role}`;
                        case 'LIST': return f.audience.listId;
                        case 'USERS': return 'Direct';
                      }
                    });
                    const defLabel = def
                      ? (def.audience.kind === 'EVERYONE'
                          ? 'Public'
                          : def.audience.kind === 'ROLE'
                            ? `Role:${def.audience.role}`
                            : def.audience.kind === 'LIST'
                              ? def.audience.listId
                              : 'Direct')
                      : '—';
                    const preview = typeof (def?.body as any)?.text === 'string'
                      ? (def?.body as any).text
                      : '—';

                    return (
                      <tr key={u.id.toString()} className="border-t">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{u.name ?? u.username}</div>
                          <div className="text-xs text-slate-500">{u.id.toString()}</div>
                        </td>
                        <td className="py-2 pr-3"><FacetBadges labels={labels as string[]} /></td>
                        <td className="py-2 pr-3">{defLabel}</td>
                        <td className="py-2"><div className="truncate text-slate-800">{preview}</div></td>
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
