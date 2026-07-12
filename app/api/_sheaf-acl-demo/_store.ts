// Simple in-memory store for dogfooding Sheaf Messages.
// Swap for Prisma later.

import { randomUUID, createHmac } from 'node:crypto';
import type {
  AudienceSelector,
  Message,
  MessageFacet,
  SharePolicy,
  UserContext,
} from '@app/sheaf-acl';
import {
  priorityRank,
  visibleFacetsFor,
  defaultFacetFor,
  canForward
} from '@app/sheaf-acl';

export type User = {
  id: string;
  name: string;
  roles: string[];         // e.g. ['MOD']
  // dynamic list memberships are derived from Lists below
};

export type AudienceList = {
  id: string;              // e.g. 'core_team'
  name: string;            // e.g. 'Core team'
  memberIds: string[];     // user ids
  version: number;         // bump on edit
};

type DBShape = {
  users: Map<string, User>;
  lists: Map<string, AudienceList>;
  messages: Map<string, Message>;
};

export const DB: DBShape = {
  users: new Map(),
  lists: new Map(),
  messages: new Map(),
};

// --------- Seed data ---------
(function seed() {
  const alice: User = { id: 'u_alice', name: 'Alice', roles: ['MOD'] };
  const bob: User   = { id: 'u_bob',   name: 'Bob',   roles: [] };
  const cara: User  = { id: 'u_cara',  name: 'Cara',  roles: [] };

  DB.users.set(alice.id, alice);
  DB.users.set(bob.id, bob);
  DB.users.set(cara.id, cara);

  const core: AudienceList = {
    id: 'core_team',
    name: 'Core team',
    memberIds: [alice.id, bob.id],
    version: 1,
  };
  DB.lists.set(core.id, core);
})();

// --------- Helpers / “ORM” ---------

export function getUserCtx(userId: string): UserContext {
  const user = DB.users.get(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  return {
    id: user.id,
    roles: new Set(user.roles),
    inList: (listId: string) => {
      const list = DB.lists.get(listId);
      return !!list?.memberIds.includes(user.id);
    },
  };
}

export function labelForAudience(a: AudienceSelector): string {
  switch (a.kind) {
    case 'EVERYONE':
      return 'Public';
    case 'ROLE':
      return `Role: ${a.role}`;
    case 'LIST': {
      const name = DB.lists.get(a.listId)?.name ?? a.listId;
      return name;
    }
    case 'USERS':
      return 'Direct';
  }
}

export function createMessage(input: {
  threadId: string;
  authorId: string;
  facets: Array<{
    audience: AudienceSelector;
    sharePolicy?: SharePolicy;
    expiresAt?: number | null;
    body: unknown;
    attachments?: Array<{ id: string; name: string; mime: string; size: number; sha256: string }>;
  }>;
  defaultFacetIndex?: number;
}): Message {
  const id = randomUUID();
  const createdAt = Date.now();

  const facets: MessageFacet[] = input.facets.map((f, idx) => {
    // Fill SNAPSHOT members at send time for safety
    const audience = { ...f.audience } as AudienceSelector;
    if (audience.kind === 'LIST' && audience.mode === 'SNAPSHOT') {
      const list = DB.lists.get(audience.listId);
      (audience as any).snapshotMemberIds = list ? [...list.memberIds] : [];
      (audience as any).listVersionAtSend = list?.version ?? 0;
    }
    if (audience.kind === 'USERS' && audience.mode === 'SNAPSHOT') {
      // If userIds were provided instead of snapshotMemberIds, freeze them now
      const ids = (audience as any).snapshotMemberIds ?? (audience as any).userIds ?? [];
      (audience as any).snapshotMemberIds = [...ids];
      delete (audience as any).userIds;
    }

    const mf: MessageFacet = {
      id: `f_${id}_${idx}`,
      messageId: id,
      audience,
      sharePolicy: f.sharePolicy ?? 'ALLOW',
      expiresAt: f.expiresAt ?? null,
      body: f.body,
      attachments: f.attachments ?? [],
      createdAt,
      priorityRank: priorityRank(audience),
    };
    return mf;
  });

  const message: Message = {
    id,
    threadId: input.threadId,
    authorId: input.authorId,
    createdAt,
    replyTo: null,
    facets,
    defaultFacetId:
      input.defaultFacetIndex != null
        ? facets[input.defaultFacetIndex]?.id ?? null
        : null,
  };

  DB.messages.set(id, message);
  return message;
}

export function listMessagesFor(userId: string) {
  const ctx = getUserCtx(userId);
  const out = [];
  for (const m of DB.messages.values()) {
    const visible = visibleFacetsFor(ctx, m.facets);
    if (visible.length === 0) continue; // nothing to show to this user
    const def = (m.defaultFacetId ? visible.find(f => f.id === m.defaultFacetId) : undefined) ?? visible[0];
    out.push({
      id: m.id,
      threadId: m.threadId,
      authorId: m.authorId,
      createdAt: m.createdAt,
      // Only visible facets are returned — no meta-leaks
      facets: visible.map(f => ({
        id: f.id,
        label: labelForAudience(f.audience),
        audience: f.audience,       // safe: only what this user sees
        sharePolicy: f.sharePolicy,
        expiresAt: f.expiresAt ?? null,
        body: f.body,
        attachments: f.attachments ?? [],
        createdAt: f.createdAt,
        priorityRank: f.priorityRank,
      })),
      defaultFacetId: def?.id ?? null,
    });
  }
  // newest first
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

// ---------- Signed preview (HMAC) ----------

const PREVIEW_SECRET = process.env.SHEAF_PREVIEW_SECRET ?? 'dev-only-secret';

export function signPreview(payload: object, expiresInMs = 60_000) {
  const exp = Date.now() + expiresInMs;
  const body = JSON.stringify({ p: payload, exp });
  const sig = createHmac('sha256', PREVIEW_SECRET).update(body).digest('base64url');
  const token = `v1.${Buffer.from(body).toString('base64url')}.${sig}`;
  return { token, expiresAt: exp };
}

export function verifyPreviewToken(token: string): { ok: boolean; payload?: any; reason?: string } {
  try {
    const [v, bodyB64, sig] = token.split('.');
    if (v !== 'v1') return { ok: false, reason: 'bad_version' };
    const body = Buffer.from(bodyB64, 'base64url').toString('utf8');
    const expected = createHmac('sha256', PREVIEW_SECRET).update(body).digest('base64url');
    if (expected !== sig) return { ok: false, reason: 'bad_signature' };
    const parsed = JSON.parse(body);
    if (Date.now() > parsed.exp) return { ok: false, reason: 'expired' };
    return { ok: true, payload: parsed.p };
  } catch (e) {
    return { ok: false, reason: 'invalid' };
  }
}
