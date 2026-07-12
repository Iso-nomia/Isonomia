export const dynamic = "force-dynamic";

// // app/api/pa/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';
// import { z } from 'zod';
// import { getCurrentUserId } from '@/lib/serverutils';

// const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

// const CreatePA = z.object({
//   deliberationId: z.string().min(6),
//   schemeKey: z.string().optional(),
//   // preferred (exactly one)
//   preferredClaimId: z.string().optional(),
//   preferredArgumentId: z.string().optional(),
//   preferredSchemeId: z.string().optional(),
//   // dispreferred (exactly one)
//   dispreferredClaimId: z.string().optional(),
//   dispreferredArgumentId: z.string().optional(),
//   dispreferredSchemeId: z.string().optional(),
// });

// export async function POST(req: NextRequest) {
//   const uid = await getCurrentUserId().catch(()=>null);
//   if (!uid) return NextResponse.json({ error:'Unauthorized' }, { status:401, ...NO_STORE });
//   const p = CreatePA.safeParse(await req.json().catch(()=>({})));
//   if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status:400, ...NO_STORE });
//   const d = p.data;

//   const pref = [d.preferredClaimId, d.preferredArgumentId, d.preferredSchemeId].filter(Boolean).length;
//   const disp = [d.dispreferredClaimId, d.dispreferredArgumentId, d.dispreferredSchemeId].filter(Boolean).length;
//   if (pref !== 1 || disp !== 1) {
//     return NextResponse.json({ error:'PA requires exactly one preferred and one dispreferred element' }, { status:400, ...NO_STORE });
//   }

//   const scheme = d.schemeKey
//     ? await prisma.preferenceScheme.findUnique({ where: { key: d.schemeKey }, select: { id:true } })
//     : null;

//   const created = await prisma.preferenceApplication.create({
//     data: { ...d, schemeId: scheme?.id ?? null, createdById: String(uid) },
//     select: { id:true }
//   });

//   return NextResponse.json({ ok:true, id: created.id }, NO_STORE);
// }

// export async function GET(req: NextRequest) {
//   const u = new URL(req.url);
//   const deliberationId = u.searchParams.get('deliberationId') ?? undefined;
//   const targetArgumentId = u.searchParams.get('targetArgumentId') ?? undefined;
//   const targetClaimId = u.searchParams.get('targetClaimId') ?? undefined;

//   const where: any = {};
//   if (deliberationId) where.deliberationId = deliberationId;
//   if (targetArgumentId) where.OR = [{ preferredArgumentId: targetArgumentId }, { dispreferredArgumentId: targetArgumentId }];
//   if (targetClaimId) where.OR = [{ preferredClaimId: targetClaimId }, { dispreferredClaimId: targetClaimId }];

//   const items = await prisma.preferenceApplication.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
//   return NextResponse.json({ ok:true, items }, NO_STORE);
// }
// app/api/pa/route.ts (shim that delegates)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;
const CreatePA = z.object({
  deliberationId: z.string().min(6),
  schemeKey: z.string().optional(),
  preferredArgumentId: z.string().optional(),
  preferredClaimId: z.string().optional(),
  preferredSchemeId: z.string().optional(),
  dispreferredArgumentId: z.string().optional(),
  dispreferredClaimId: z.string().optional(),
  dispreferredSchemeId: z.string().optional(),
  // ASPIC+ Phase 4.2: Ordering metadata
  orderingPolicy: z.enum(["last-link", "weakest-link"]).optional(),
  setComparison: z.enum(["elitist", "democratic"]).optional(),
  justification: z.string().optional(),
});


export async function POST(req: NextRequest) {
  const uid = await getCurrentUserId().catch(()=>null);
  if (!uid) return NextResponse.json({ error:'Unauthorized' }, { status:401, ...NO_STORE });
  const p = CreatePA.safeParse(await req.json().catch(()=>({})));
  if (!p.success) return NextResponse.json({ error:p.error.flatten() }, { status:400, ...NO_STORE });
  const d = p.data;

  // Enforce “exactly one” on both sides
  const pref = [d.preferredArgumentId, d.preferredClaimId, d.preferredSchemeId].filter(Boolean).length;
  const disp = [d.dispreferredArgumentId, d.dispreferredClaimId, d.dispreferredSchemeId].filter(Boolean).length;
  if (pref !== 1 || disp !== 1) {
    return NextResponse.json({ error:'PA requires exactly one preferred and one dispreferred element' }, { status:400, ...NO_STORE });
  }

  // Phase 4.4: referential validation. preferred/dispreferred IDs are polymorphic
  // (claim | argument | scheme), so they can't be enforced as DB FKs; verify
  // argument/claim refs exist in THIS deliberation to prevent dangling references.
  // (Also rejects a self-preference where preferred === dispreferred: the count
  // won't match the requested id count.) Scheme-side refs are rare and not
  // deliberation-scoped; left unvalidated here.
  const argIds = [d.preferredArgumentId, d.dispreferredArgumentId].filter(Boolean) as string[];
  const claimIds = [d.preferredClaimId, d.dispreferredClaimId].filter(Boolean) as string[];
  const [argCount, claimCount] = await Promise.all([
    argIds.length ? prisma.argument.count({ where: { id: { in: argIds }, deliberationId: d.deliberationId } }) : Promise.resolve(0),
    claimIds.length ? prisma.claim.count({ where: { id: { in: claimIds }, deliberationId: d.deliberationId } }) : Promise.resolve(0),
  ]);
  if (argCount !== argIds.length || claimCount !== claimIds.length) {
    return NextResponse.json({ error:'Referenced preferred/dispreferred argument or claim not found in this deliberation' }, { status:400, ...NO_STORE });
  }

  const scheme = d.schemeKey
    ? await prisma.preferenceScheme.findUnique({ where: { key: d.schemeKey }, select: { id:true } })
    : null;

  const created = await prisma.preferenceApplication.create({
    data: {
      deliberationId: d.deliberationId,
      schemeId: scheme?.id ?? null,
      createdById: String(uid),
      preferredArgumentId: d.preferredArgumentId ?? null,
      preferredClaimId: d.preferredClaimId ?? null,
      preferredSchemeId: d.preferredSchemeId ?? null,
      dispreferredArgumentId: d.dispreferredArgumentId ?? null,
      dispreferredClaimId: d.dispreferredClaimId ?? null,
      dispreferredSchemeId: d.dispreferredSchemeId ?? null,
      // ASPIC+ Phase 4.2: Save ordering metadata
      orderingPolicy: d.orderingPolicy ?? null,
      setComparison: d.setComparison ?? null,
      justification: d.justification ?? null,
    },
    select: { id:true },
  });

  return NextResponse.json({ ok:true, id: created.id }, NO_STORE);
}