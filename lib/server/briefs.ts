import { prisma } from '@/lib/prismaclient';

export async function resolveBriefByParam(param: string) {
  const byId = await prisma.brief.findUnique({ where: { id: param } });
  if (byId) return byId;
  const bySlug = await prisma.brief.findUnique({ where: { slug: param } });
  return bySlug;
}

/** Read brief param from header or route; allows header override for tests/internal calls */
export async function getBriefParam(req: Request, fallbackParam?: string) {
  const hdr = req.headers.get('x-brief-param');
  const param = hdr && hdr.trim().length ? hdr.trim() : (fallbackParam ?? '');
  if (!param) return null;
  return resolveBriefByParam(param);
}
