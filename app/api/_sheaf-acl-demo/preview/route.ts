export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { ok, badRequest, readJSON, devOnlyGuard } from '../_util';
import { DB, getUserCtx, labelForAudience, signPreview } from '../_store';
import type { AudienceSelector, MessageFacet, Message, UserContext } from '@app/sheaf-acl';
import { visibleFacetsFor, defaultFacetFor, priorityRank } from '@app/sheaf-acl';
import { createHash } from 'node:crypto';

// POST /api/_sheaf-acl-demo/preview
// Body: { draftMessage: {threadId, authorId, facets[...]}, viewAs: { userId? | role? | everyone? } }
// Returns: visible facets + defaultFacet for that hypothetical viewer + signed token (60s)
export async function POST(req: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;
  type DraftFacet = {
    audience: AudienceSelector;
    sharePolicy?: 'ALLOW'|'REDACT'|'FORBID';
    expiresAt?: number | null;
    body: unknown;
    attachments?: Array<{ id: string; name: string; mime: string; size: number; sha256: string }>;
  };
  type Body = {
    draftMessage: {
      threadId: string;
      authorId: string;
      facets: DraftFacet[];
    };
    viewAs: { userId?: string; role?: string; everyone?: boolean };
  };

  let body: Body;
  try {
    body = await readJSON<Body>(req);
  } catch {
    return badRequest('Invalid JSON');
  }

  const { draftMessage, viewAs } = body;
  if (!draftMessage?.authorId || !Array.isArray(draftMessage?.facets) || draftMessage.facets.length === 0) {
    return badRequest('Missing draftMessage fields');
  }

  // Build a synthetic Message with filled snapshot members where needed (LIST/USERS SNAPSHOT)
  const createdAt = Date.now();
  const facets: MessageFacet[] = draftMessage.facets.map((f, idx) => {
    const aud = { ...f.audience } as AudienceSelector;
    if (aud.kind === 'LIST' && aud.mode === 'SNAPSHOT') {
      const list = DB.lists.get(aud.listId);
      (aud as any).snapshotMemberIds = list ? [...list.memberIds] : [];
      (aud as any).listVersionAtSend = list?.version ?? 0;
    }
    if (aud.kind === 'USERS' && aud.mode === 'SNAPSHOT') {
      const ids = (aud as any).snapshotMemberIds ?? (aud as any).userIds ?? [];
      (aud as any).snapshotMemberIds = [...ids];
      delete (aud as any).userIds;
    }
    return {
      id: `draft_f_${idx}`,
      messageId: 'draft',
      audience: aud,
      sharePolicy: f.sharePolicy ?? 'ALLOW',
      expiresAt: f.expiresAt ?? null,
      body: f.body,
      attachments: f.attachments ?? [],
      createdAt,
      priorityRank: priorityRank(aud),
    };
  });

  // Build a UserContext for "viewAs"
  let ctx: UserContext;
  if (viewAs?.userId) {
    if (!DB.users.get(viewAs.userId)) return badRequest('Unknown viewAs.userId');
    ctx = getUserCtx(viewAs.userId);
  } else if (viewAs?.role) {
    ctx = { id: `role:${viewAs.role}`, roles: new Set([viewAs.role]) };
  } else {
    ctx = { id: 'anon', roles: new Set() }; // everyone/no-roles
  }

  const visible = visibleFacetsFor(ctx, facets);
  if (visible.length === 0) {
    const token = signPreview({ ok: true, visible: [], defaultFacetId: null }).token;
    return ok({ visible: [], defaultFacetId: null, labels: [], token, expiresInMs: 60_000 });
  }

  const def = defaultFacetFor(ctx, facets);

  // Sign a short-lived preview token (client can attach this to a preview UI if needed)
  const draftHash = createHash('sha256').update(JSON.stringify(draftMessage)).digest('base64url');
  const { token, expiresAt } = signPreview({ draftHash, as: viewAs, facetIds: visible.map(f => f.id) });

  return ok({
    visible: visible.map(f => ({
      id: f.id,
      label: labelForAudience(f.audience),
      audience: f.audience,
      sharePolicy: f.sharePolicy,
      body: f.body,
    })),
    defaultFacetId: def?.id ?? visible[0].id,
    token,
    expiresAt,
  });
}
