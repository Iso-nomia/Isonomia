import { prisma } from '@/lib/prismaclient';
import type { Prisma, PrismaClient } from '@prisma/client';

type DB = PrismaClient;

/**
 * Clone a subtree of acts from one address to another *within the same design*,
 * creating any missing loci and rewriting meta.justifiedByLocus addresses.
 *
 * Example: faxClone({ designId, fromPath:'0.2', toPath:'0.5' })
 */
export async function faxClone(params: {
  designId: string;
  fromPath: string; // e.g. "0.2"
  toPath: string;   // e.g. "0.5"
  rewriteMeta?: boolean;
}) {
  const { designId, fromPath, toPath, rewriteMeta = true } = params;

  return prisma.$transaction(async (tx) => {
    // 0) fetch design & dialogue
    const design = await tx.ludicDesign.findUnique({
      where: { id: designId }, select: { id: true, deliberationId: true }
    });
    if (!design) throw new Error('NO_SUCH_DESIGN');

    // 1) gather all source loci under fromPath
    const loci = await tx.ludicLocus.findMany({
      where: {
        dialogueId: design.deliberationId,
        OR: [{ path: fromPath }, { path: { startsWith: fromPath + '.' } }],
      },
      select: { id: true, path: true, parentId: true },
    });
    if (!loci.length) return { ok: true, clonedActs: 0, clonedLoci: 0 };

    // 2) ensure the destination locus tree exists, building every target path
    const ensure = async (p: string) => {
      const hit = await tx.ludicLocus.findFirst({ where: { dialogueId: design.deliberationId, path: p } });
      if (hit) return hit;
      const parts = p.split('.').filter(Boolean);
      let parentPath = '';
      let parentId: string | undefined = undefined;
      for (let i = 0; i < parts.length; i++) {
        const sub = (parentPath ? parentPath + '.' : '') + parts[i];
        let node = await tx.ludicLocus.findFirst({ where: { dialogueId: design.deliberationId, path: sub } });
        if (!node) node = await tx.ludicLocus.create({ data: { dialogueId: design.deliberationId, path: sub, parentId } });
        parentPath = sub; parentId = node.id;
      }
      const final = await tx.ludicLocus.findFirst({ where: { dialogueId: design.deliberationId, path: p } });
      if (!final) throw new Error('ENSURE_LOCUS_FAILED');
      return final;
    };

    // 3) map every source locus to a destination locus
    const locMap = new Map<string /*srcId*/, string /*dstId*/>();
    for (const src of loci) {
      const suffix = src.path.slice(fromPath.length); // "", ".1", ".1.2", …
      const dstPath = (toPath + suffix).replace(/\.$/, '');
      const dst = await ensure(dstPath);
      locMap.set(src.id, dst.id);
    }

    // 4) fetch acts for this design at those loci, keep order
    const acts = await tx.ludicAct.findMany({
      where: { designId, locusId: { in: Array.from(locMap.keys()) } },
      orderBy: { orderInDesign: 'asc' },
      select: {
        id: true, kind: true, polarity: true, locusId: true, ramification: true,
        expression: true, metaJson: true, isAdditive: true, orderInDesign: true
      },
    });

    // 5) find next order index
    const last = await tx.ludicAct.findFirst({ where: { designId }, orderBy: { orderInDesign: 'desc' } });
    let order = (last?.orderInDesign ?? 0);

    // 6) clone acts into destination
    let cloned = 0;
    for (const a of acts) {
      const newLocusId = a.locusId ? locMap.get(a.locusId) : undefined;
      const meta = (a.metaJson ?? {}) as any;
      const rewritten = rewriteMeta && typeof meta.justifiedByLocus === 'string'
        ? { ...meta, justifiedByLocus: meta.justifiedByLocus.replace(fromPath, toPath) }
        : meta;

      const clone = await tx.ludicAct.create({
        data: {
          designId,
          kind: a.kind,
          polarity: a.polarity,
          locusId: newLocusId,
          ramification: a.ramification,
          expression: a.expression,
          metaJson: rewritten as Prisma.InputJsonValue,
          isAdditive: a.isAdditive,
          orderInDesign: ++order,
        }
      });
      await tx.ludicChronicle.create({ data: { designId, order, actId: clone.id } });
      cloned++;
    }

    return { ok: true, clonedActs: cloned, clonedLoci: loci.length };
  });
}
