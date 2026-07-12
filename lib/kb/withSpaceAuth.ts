// // // lib/kb/withSpaceAuth.ts
// // import { NextRequest, NextResponse } from 'next/server';
// // import { prisma } from '@/lib/prismaclient';

// // export type KbRole = 'reader' | 'editor' | 'owner';
// // const RANK: Record<KbRole, number> = { reader: 1, editor: 2, owner: 3 };

// // // --- Swap this with your real session lookup ---
// // async function getUserId(req: NextRequest): Promise<string | null> {
// //   // Try common patterns in your app, then fall back to dev header
// //   try {
// //     // @ts-ignore - your auth lib may expose this differently:
// //     const uid = (req as any)?.auth?.user?.id || null;
// //     if (uid) return uid;
// //   } catch {}
// //   const hdr = req.headers.get('x-user-id');
// //   return hdr && hdr.trim() ? hdr.trim() : null;
// // }
// // // ------------------------------------------------

// // export async function requireKbRole(
// //   req: NextRequest,
// //   opts: { spaceId?: string; pageId?: string; need: KbRole }
// // ): Promise<{ userId: string; spaceId: string; role: KbRole }> {
// //   const userId = await getUserId(req);
// //   if (!userId) {
// //     throw new NextResponse(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
// //   }

// //   // Resolve spaceId from page if needed
// //   let spaceId = opts.spaceId ?? null;
// //   if (!spaceId && opts.pageId) {
// //     const p = await prisma.kbPage.findUnique({
// //       where: { id: opts.pageId },
// //       select: { id: true, spaceId: true },
// //     });
// //     if (!p) {
// //       // Hide existence to avoid enumeration
// //       throw new NextResponse(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
// //     }
// //     spaceId = p.spaceId;
// //   }
// //   if (!spaceId) {
// //     throw new NextResponse(JSON.stringify({ ok: false, error: 'space_required' }), { status: 400 });
// //   }

// //   // Member lookup
// //   const m = await prisma.kbSpaceMember.findFirst({
// //     where: { spaceId, userId },
// //     select: { role: true },
// //   });

// //   // Owner shortcut (if you store owner on space)
// //   let ownerBoost: KbRole | null = null;
// //   const sp = await prisma.kbSpace.findUnique({
// //     where: { id: spaceId },
// //     select: { ownerId: true },
// //   });
// //   if (sp?.ownerId && sp.ownerId === userId) ownerBoost = 'owner';

// //   const have: KbRole = ownerBoost ?? (m?.role as KbRole ?? null) ?? 'reader'; // default to lowest if member found; else no access

// //   if (!m && !ownerBoost) {
// //     // Not a member at all → hide space existence
// //     throw new NextResponse(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
// //   }
// //   if (RANK[have] < RANK[opts.need]) {
// //     throw new NextResponse(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 });
// //   }

// //   return { userId, spaceId, role: have };
// // }

// // export function fail(err: unknown): NextResponse {
// //   if (err instanceof NextResponse) return err;
// //   const msg = (err as any)?.message ?? 'server_error';
// //   return new NextResponse(JSON.stringify({ ok: false, error: msg }), { status: 500 });
// // }
// // lib/kb/withSpaceAuth.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';
// import { getUserFromCookies } from '@/lib/serverutils';

// type Role = 'reader'|'commenter'|'editor'|'owner';
// const RANK: Record<Role, number> = { reader:0, commenter:1, editor:2, owner:3 };

// export async function requireKbRole(
//   _req: NextRequest,
//   opts: { spaceId?: string; pageId?: string; need: Role }
// ): Promise<{ userId: string; spaceId: string; role: Role }> {
//   const user = await getUserFromCookies();
//   if (!user) throw { status: 401, message: 'unauthorized' };
//   const userId = String((user as any).userId ?? user.id);

//   let spaceId = opts.spaceId;
//   if (!spaceId) {
//     if (!opts.pageId) throw { status: 400, message: 'missing spaceId or pageId' };
//     const page = await prisma.kbPage.findUnique({
//       where: { id: opts.pageId },
//       select: { id: true, spaceId: true },
//     });
//     if (!page) throw { status: 404, message: 'not_found' };
//     spaceId = page.spaceId;
//   }

//   const space = await prisma.kbSpace.findUnique({
//     where: { id: spaceId! },
//     select: {
//       id: true,
//       createdById: true,
//       members: { where: { userId }, select: { role: true }, take: 1 },
//     },
//   });
//   if (!space) throw { status: 404, message: 'not_found' };

//   const have: Role =
//     String(space.createdById) === userId
//       ? 'owner'
//       : ((space.members[0]?.role as Role) ?? null as any);

//   if (!have) throw { status: 403, message: 'forbidden' };
//   if (RANK[have] < RANK[opts.need]) throw { status: 403, message: 'forbidden' };

//   return { userId, spaceId: space.id, role: have };
// }

// /** Uniform API error formatter used by routes */
// export function fail(err: any) {
//   const status = typeof err?.status === 'number' ? err.status : 500;
//   const code =
//     status === 401 ? 'unauthorized' :
//     status === 403 ? 'forbidden' :
//     status === 404 ? 'not_found' : 'error';
//   const message = err?.message ?? code;
//   return NextResponse.json({ ok: false, error: code, message }, { status });
// }
// lib/kb/withSpaceAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';

type Need = 'reader'|'editor'|'owner';
const RANK: Record<Need, number> = { reader: 1, editor: 2, owner: 3 };

export async function currentUserOr401() {
  const user = await getUserFromCookies();
  if (!user) throw NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return { userId: String(user.userId ?? (user as { id?: unknown }).id) };
}

export async function requireKbRole(
  req: NextRequest,
  opts: { spaceId?: string; pageId?: string; need: Need }
) {
  const { userId } = await currentUserOr401();

  const spaceId = opts.spaceId ?? (
    opts.pageId
      ? (await prisma.kbPage.findUnique({ where: { id: opts.pageId }, select: { spaceId: true } }))?.spaceId
      : undefined
  );
  if (!spaceId) throw NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Owner of page OR member with sufficient role in space
  const space = await prisma.kbSpace.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
  });
  const rank = space?.members?.[0]?.role ? R2(space.members[0].role) : 0;
  const needRank = RANK[opts.need];
  if (rank < needRank) throw NextResponse.json({ error: 'forbidden' }, { status: 403 });

  return { userId, spaceId };
}
function R2(role: string): number {
  // Prisma enum KbRole: owner|editor|commenter|reader
  if (role === 'owner') return 3;
  if (role === 'editor') return 2;
  return 1; // commenter/reader -> reader level
}

// Small helper for error normalization from try/catch blocks
export function fail(err: unknown) {
  if (err instanceof NextResponse) return err;
  const msg = (err as any)?.message ?? 'internal_error';
  return NextResponse.json({ error: msg }, { status: 500 });
}
