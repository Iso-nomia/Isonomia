// scripts/seed-demo-deliberation.ts
import 'dotenv/config';
import { prisma } from '@/lib/prismaclient';
import { maybeUpsertClaimEdgeFromArgumentEdge } from '@/lib/deepdive/claimEdgeHelpers';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
import { mintUrn } from '@/lib/ids/urn';

type SeedArg = {
  key: string; text: string; sources?: string[];
};
type SeedEdge = {
  from: string; to: string;
  kind: 'support'|'rebut'|'rebut_premise'|'undercut_inference';
};

async function ensureUser(authId: string, username: string, name: string) {
  const u = await prisma.user.findUnique({ where: { auth_id: authId } });
  if (u) return u;
  return prisma.user.create({
    data: { auth_id: authId, username, name },
  });
}

export async function seedDeliberation(deliberationId: string) {
  // 0) demo users
  const users = await Promise.all([
    ensureUser('demo-auth-1', 'demo1', 'Ada'),
    ensureUser('demo-auth-2', 'demo2', 'Bo'),
    ensureUser('demo-auth-3', 'demo3', 'Chen'),
    ensureUser('demo-auth-4', 'demo4', 'Dee'),
  ]);
  const createdByAuth = users[0].auth_id; // use auth_id consistently as String FK

  // 1) arguments
  const A: SeedArg[] = [
    { key: 'A1', text: 'Plurality can elect a Condorcet loser.' },
    { key: 'A2', text: 'Borda count is susceptible to rank manipulation.' },
    { key: 'A3', text: 'Arrow’s theorem shows no rank-order rule satisfies all four axioms.' },
    { key: 'A4', text: 'Condorcet cycles can occur in realistic electorates.' },
    { key: 'A5', text: 'Runoff reduces spoiler effects relative to plurality.' },
    { key: 'A6', text: 'IIA is a contentious normative requirement.' },
    { key: 'A7', text: 'Simplicity justifies plurality.' }, // foil
  ];

  const created: Record<string, { id: string }> = {};
  for (const a of A) {
    const arg = await prisma.argument.create({
      data: {
        deliberationId,
        authorId: createdByAuth,         // Argument.authorId is String in your DB
        text: a.text,
        mediaType: 'text',
      },
    });
    created[a.key] = { id: arg.id };
  }

  // 2) argument-level edges
  const E: SeedEdge[] = [
    { from: 'A3', to: 'A7', kind: 'rebut' },             // Arrow → rebut simplicity
    { from: 'A1', to: 'A7', kind: 'rebut' },             // Condorcet-loser → rebut simplicity
    { from: 'A2', to: 'A5', kind: 'rebut_premise' },     // undermine a premise in 'runoff reduces spoilers'
    { from: 'A6', to: 'A3', kind: 'undercut_inference' },// undercut Arrow ⇒ “method is bad”
    { from: 'A4', to: 'A1', kind: 'support' },           // cycles support Condorcet-loser
  ];

  const mapKind = (k: SeedEdge['kind']) =>
    k === 'support'
      ? { type: 'support' as const, targetScope: undefined }
      : k === 'rebut'
      ? { type: 'rebut' as const, targetScope: 'conclusion' as const }
      : k === 'rebut_premise'
      ? { type: 'rebut' as const, targetScope: 'premise' as const }
      : { type: 'undercut' as const, targetScope: 'inference' as const };

  for (const e of E) {
    const fromArgumentId = created[e.from].id;
    const toArgumentId   = created[e.to].id;
    const { type, targetScope } = mapKind(e.kind);

    const edge = await prisma.argumentEdge.create({
      data: {
        deliberationId,
        fromArgumentId,
        toArgumentId,
        type,                 // 'support' | 'rebut' | 'undercut'
        targetScope,          // 'premise' | 'inference' | 'conclusion' | undefined
        createdById: createdByAuth, // required String
      },
    });

    // materialize ClaimEdge if both ends are already promoted (later pass also handles it)
    await maybeUpsertClaimEdgeFromArgumentEdge(edge.id);
  }

  // 3) promote arguments to claims (with moid + URN) and back-link
  for (const key of Object.keys(created)) {
    const argId = created[key].id;
    const arg = await prisma.argument.findUnique({
      where: { id: argId },
      select: { claimId: true, text: true },
    });
    if (!arg) continue;

    if (!arg.claimId) {
      const moid = mintClaimMoid(arg.text);
      const urn  = mintUrn('claim', moid);

      const claim = await prisma.claim.create({
        data: {
          deliberationId,
          text: arg.text,
          createdById: String(users[0].id), // your Claim.createdById is String; server uses String(userId)
          moid,
          urns: {
            create: { entityType: 'claim', urn },
          },
        },
      });

      await prisma.argument.update({
        where: { id: argId },
        data:  { claimId: claim.id },
      });

      // re-materialize edges now that this side has a claimId
      const incident = await prisma.argumentEdge.findMany({
        where: { OR: [{ fromArgumentId: argId }, { toArgumentId: argId }] },
        select: { id: true },
      });
      for (const ie of incident) {
        await maybeUpsertClaimEdgeFromArgumentEdge(ie.id);
      }
    }
  }

  // 3b) sweep all argumentEdges and materialize any missing ClaimEdges (safety)
  const allArgEdges = await prisma.argumentEdge.findMany({
    where: { deliberationId },
    select: { id: true },
  });
  for (const e of allArgEdges) {
    await maybeUpsertClaimEdgeFromArgumentEdge(e.id);
  }

  // 4) approvals (best-effort: userId type may vary; wrap in try/catch)
  const allClaims = await prisma.claim.findMany({ where: { deliberationId } });
  for (const c of allClaims) {
    const arg = await prisma.argument.findFirst({
      where: { claimId: c.id },
      select: { id: true },
    });
    if (!arg) continue;

    for (const u of users) {
      if (Math.random() < 0.55) {
        try {
          // If your ArgumentApproval.userId expects String of user.id:
          await prisma.argumentApproval.create({
            data: {
              deliberationId,
              argumentId: arg.id,
              userId: String(u.id),
            },
          });
        } catch {
          // Fallback: if it expects auth_id instead
          try {
            await prisma.argumentApproval.create({
              data: {
                deliberationId,
                argumentId: arg.id,
                // @ts-ignore
                userId: u.auth_id,
              },
            });
          } catch (err) {
            console.warn('[seed approvals] skip one:', (err as any)?.message ?? err);
          }
        }
      }
    }
  }

  // 5) grounded semantics
  try {
    await recomputeGroundedForDelib(deliberationId);
  } catch (err) {
    console.warn('[seed] grounded recompute failed:', (err as any)?.message ?? err);
  }

  console.log('Seeded demo deliberation:', deliberationId, { claims: allClaims.length });
}

if (require.main === module) {
  const id = process.argv[2];
  if (!id) throw new Error('Usage: tsx scripts/seed-demo-deliberation.ts <deliberationId>');
  seedDeliberation(id).then(() => process.exit(0));
}
