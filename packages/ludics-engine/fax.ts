import { prisma } from '@/lib/prismaclient';

export async function faxBranch(params: {
  dialogueId: string;
  fromDesignId: string;
  toDesignId: string;
  fromLocusPath: string; // e.g., "0.2"
  toLocusPath: string;   // e.g., "0.5"
  includeActs?: boolean; // default true
}) {
  const { dialogueId, fromDesignId, toDesignId, fromLocusPath, toLocusPath } = params;
  const includeActs = params.includeActs ?? true;

  // 1) collect loci under fromPath
  const fromLoci = await prisma.ludicLocus.findMany({
    where: {
      dialogueId,
      OR: [
        { path: fromLocusPath },
        { path: { startsWith: fromLocusPath + '.' } },
      ],
    },
  });

  // helper to ensure a locus exists (creating chain as needed)
  async function ensure(dialogueId: string, path: string) {
    const parts = path.split('.').filter(Boolean);
    let parentPath = '';
    let parentId: string | undefined = undefined;
    for (let i = 0; i < parts.length; i++) {
      const p = (parentPath ? parentPath + '.' : '') + parts[i];
      let hit = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: p } });
      if (!hit) {
        hit = await prisma.ludicLocus.create({ data: { dialogueId, path: p, parentId } });
      }
      parentId = hit.id;
      parentPath = p;
    }
    return prisma.ludicLocus.findFirst({ where: { dialogueId, path } });
  }

  // 2) create the mirrored loci under toPath
  const mapOldToNewId = new Map<string, string>(); // oldLocusId -> newLocusId
  for (const src of fromLoci) {
    const suffix = src.path.substring(fromLocusPath.length);
    const newPath = (toLocusPath + suffix).replace(/\.$/, '');
    const dst = await ensure(dialogueId, newPath);
    if (dst) mapOldToNewId.set(src.id, dst.id);
  }

  if (!includeActs) {
    // record the mapping only
    for (const src of fromLoci) {
      const suffix = src.path.substring(fromLocusPath.length);
      const newPath = (toLocusPath + suffix).replace(/\.$/, '');
      const srcId = src.id;
      const dst = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: newPath } });
      if (dst) {
        await prisma.ludicFaxMap.create({ data: { fromLocusId: srcId, toLocusId: dst.id } });
      }
    }
    return { ok: true, clonedActs: 0, clonedLoci: fromLoci.length };
  }

  // 3) copy acts from fromDesign to toDesign with rewritten locusIds
  const acts = await prisma.ludicAct.findMany({
    where: { designId: fromDesignId, locusId: { in: Array.from(mapOldToNewId.keys()) } },
    orderBy: { orderInDesign: 'asc' },
  });

  let lastOrder = (await prisma.ludicAct.findFirst({
    where: { designId: toDesignId },
    orderBy: { orderInDesign: 'desc' },
  }))?.orderInDesign ?? 0;

  for (const a of acts) {
    const newLocusId = a.locusId ? mapOldToNewId.get(a.locusId) : null;
    const clone = await prisma.ludicAct.create({
      data: {
        designId: toDesignId,
        kind: a.kind,
        polarity: a.polarity,
        locusId: newLocusId ?? undefined,
        ramification: a.ramification,
        expression: a.expression,
        metaJson: a.metaJson ?? undefined,
        isAdditive: a.isAdditive,
        orderInDesign: ++lastOrder,
        extJson: {
          ...(a.extJson && typeof a.extJson === "object" && !Array.isArray(a.extJson)
            ? (a.extJson as Record<string, unknown>)
            : {}),
          faxOf: a.id,
        },
      },
    });
    await prisma.ludicChronicle.create({ data: { designId: toDesignId, order: lastOrder, actId: clone.id } });
  }

  // 4) record FaxMap for each locus pair
  for (const [oldId, newId] of mapOldToNewId.entries()) {
    await prisma.ludicFaxMap.create({ data: { fromLocusId: oldId, toLocusId: newId } });
  }

  return { ok: true, clonedActs: acts.length, clonedLoci: fromLoci.length };
}
