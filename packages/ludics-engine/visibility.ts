import { prisma } from '@/lib/prismaclient';
import { LudicError, E } from 'packages/ludics-core/errors';

export async function validateVisibility(designId: string) {
  const acts = await prisma.ludicAct.findMany({
    where: { designId },
    include: { locus: true },
    orderBy: { orderInDesign: 'asc' },
  });

  const seenByPath = new Set<string>();
  for (const a of acts) {
    const path = a.locus?.path ?? '0';
    seenByPath.add(path);
    const meta = (a.metaJson ?? {}) as any;
    const must = meta?.justifiedByLocus as string | undefined;

    if (must) {
      const ok = seenByPath.has(must) || path === must || path.startsWith(must + '.');
      if (!ok) {
        throw new LudicError(E.Visibility, `Act ${a.id} at ${path} not justified by ${must}`, { actId: a.id, path, must });
      }
    }
  }
  return { ok: true };
}
