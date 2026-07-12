import { prisma } from '@/lib/prismaclient';

// find next fresh integer child suffix at base σ
async function nextFreshChild(dialogueId: string, basePath: string): Promise<number> {
  const existing = await prisma.ludicLocus.findMany({
    where: { dialogueId, path: { startsWith: `${basePath}.` } },
    select: { path: true },
  });
  const nums = new Set<number>();
  for (const { path } of existing) {
    const tail = path.slice(basePath.length + 1).split('.')[0];
    const n = Number(tail);
    if (Number.isInteger(n) && n >= 0) nums.add(n);
  }
  let k = 0; while (nums.has(k)) k++;
  return k;
}

export async function copyAtLocus(dialogueId: string, basePath: string, count = 2) {
  // ensure base locus exists
  let base = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: basePath } });
  if (!base) base = await prisma.ludicLocus.create({ data: { dialogueId, path: basePath } });

  const children: string[] = [];
  const bijection: Record<string, string> = {};
  for (let t = 0; t < count; t++) {
    const k = await nextFreshChild(dialogueId, basePath);
    const child = `${basePath}.${k}`;
    await prisma.ludicLocus.create({ data: { dialogueId, path: child } });
    children.push(child);
    bijection[child] = basePath;
  }
  return { children, bijection };
}
