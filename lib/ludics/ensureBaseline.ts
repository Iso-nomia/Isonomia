import { prisma } from "@/lib/prismaclient";

/**
 * Idempotently ensure a pair of baseline Ludics designs for a deliberation.
 * Returns { proId, oppId }.
 *
 * Conventions:
 * - We scope loci by dialogueId = deliberationId (unique on (dialogueId,path))
 * - Two root loci: 'P' and 'O' (you can change the names, keep them stable)
 * - Two designs: extJson.role = 'pro' | 'opp', participantId = creator
 * - Optional: seed first root acts + chronicle at order 0
 */
export async function ensureBaselineLudicsDesigns(opts: {
  deliberationId: string;
  participantId: string; // creator's user id
  seedActs?: boolean;    // default true
}) {
  const { deliberationId, participantId, seedActs = true } = opts;

  // fast path: if both already exist, return them
  const existing = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    select: { id: true, extJson: true },
  });

  const byRole = new Map<string, string>();
  for (const d of existing) {
    const role = (d.extJson as any)?.role;
    if (role === "pro" || role === "opp") byRole.set(role, d.id);
  }
  if (byRole.has("pro") && byRole.has("opp")) {
    return { proId: byRole.get("pro")!, oppId: byRole.get("opp")! };
  }

  // Ensure root loci (scoped by dialogue)
  const [rootP, rootO] = await Promise.all([
    prisma.ludicLocus.upsert({
      where: { dialogueId_path: { dialogueId: deliberationId, path: "P" } },
      update: {},
      create: { dialogueId: deliberationId, path: "P" },
      select: { id: true },
    }),
    prisma.ludicLocus.upsert({
      where: { dialogueId_path: { dialogueId: deliberationId, path: "O" } },
      update: {},
      create: { dialogueId: deliberationId, path: "O" },
      select: { id: true },
    }),
  ]);

  // Create designs as needed (note: no 'side' column in schema)
  const results = await prisma.$transaction(async (tx) => {
    let proId = byRole.get("pro");
    let oppId = byRole.get("opp");

    if (!proId) {
      const pro = await tx.ludicDesign.create({
        data: {
          deliberationId,
          participantId,
          rootLocusId: rootP.id,
          semantics: "ludics-v1",
          hasDaimon: false,
          version: 1,
          extJson: { role: "pro" }, // <- tag so client can resolve quickly
        },
        select: { id: true },
      });
      proId = pro.id;

      if (seedActs) {
        const act = await tx.ludicAct.create({
          data: {
            designId: proId,
            kind: "PROPER",
            polarity: "P",
            locusId: rootP.id,
            ramification: [],
            expression: "start",
            isAdditive: false,
            orderInDesign: 0,
          } as any,
          select: { id: true },
        });
        await tx.ludicChronicle.create({
          data: { designId: proId, order: 0, actId: act.id },
        });
      }
    }

    if (!oppId) {
      const opp = await tx.ludicDesign.create({
        data: {
          deliberationId,
          participantId,
          rootLocusId: rootO.id,
          semantics: "ludics-v1",
          hasDaimon: false,
          version: 1,
          extJson: { role: "opp" },
        },
        select: { id: true },
      });
      oppId = opp.id;

      if (seedActs) {
        const act = await tx.ludicAct.create({
          data: {
            designId: oppId,
            kind: "PROPER",
            polarity: "O",
            locusId: rootO.id,
            ramification: [],
            expression: "start",
            isAdditive: false,
            orderInDesign: 0,
          } as any,
          select: { id: true },
        });
        await tx.ludicChronicle.create({
          data: { designId: oppId, order: 0, actId: act.id },
        });
      }
    }

    return { proId: proId!, oppId: oppId! };
  });

  return results;
}
