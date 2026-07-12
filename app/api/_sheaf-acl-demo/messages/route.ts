export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { ok, badRequest, readJSON, devOnlyGuard } from '../_util';
import { DB, createMessage, getUserCtx, labelForAudience, listMessagesFor } from '../_store';
import type { AudienceSelector } from '@app/sheaf-acl';
import { visibleFacetsFor, defaultFacetFor } from '@app/sheaf-acl';

// GET /api/_sheaf-acl-demo/messages?userId=...
// Renders messages per-viewer with only visible facets (no meta-leaks).
export async function GET(req: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return badRequest('Missing userId');
  if (!DB.users.get(userId)) return badRequest('Unknown userId');

  const results = listMessagesFor(userId);
  return ok({ userId, messages: results });
}

// POST /api/_sheaf-acl-demo/messages
// Create a message with facets (v1: public + LIST(SNAPSHOT) works great)
export async function POST(req: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  type FacetInput = {
    audience: AudienceSelector;
    sharePolicy?: 'ALLOW'|'REDACT'|'FORBID';
    expiresAt?: number | null;
    body: unknown;
    attachments?: Array<{ id: string; name: string; mime: string; size: number; sha256: string }>;
  };
  type Body = {
    threadId: string;
    authorId: string;
    facets: FacetInput[];
    defaultFacetIndex?: number;
  };

  let body: Body;
  try {
    body = await readJSON<Body>(req);
  } catch {
    return badRequest('Invalid JSON');
  }

  // Minimal validation
  if (!body.threadId || !body.authorId || !Array.isArray(body.facets) || body.facets.length === 0) {
    return badRequest('Missing threadId/authorId/facets');
  }
  if (!DB.users.get(body.authorId)) return badRequest('Unknown authorId');

  try {
    const message = createMessage(body);
    // For immediate dogfooding, return how each seeded user would see it (debug)
    const debugViews = Array.from(DB.users.values()).map(u => {
      const ctx = getUserCtx(u.id);
      const visible = visibleFacetsFor(ctx, message.facets);
      const def = defaultFacetFor(ctx, message.facets);
      return {
        userId: u.id,
        visibleFacetLabels: visible.map(f => labelForAudience(f.audience)),
        defaultFacetId: def?.id ?? null,
      };
    });
    return ok({ messageId: message.id, debugViews });
  } catch (e: any) {
    return badRequest('Failed to create message', { detail: e?.message });
  }
}
