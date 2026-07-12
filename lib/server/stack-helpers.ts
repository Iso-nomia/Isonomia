// lib/server/stack-helpers.ts
import { prisma } from "@/lib/prismaclient";
import { slugify } from "@/lib/slug";



export async function ensureUniqueSlug(base: string) {
  let s = slugify(base) || "stack";
  let n = 1;
  for (;;) {
    const exists = await prisma.stack.findUnique({ where: { slug: s } });
    if (!exists) return s;
    n += 1;
    s = `${slugify(base)}-${n}`;
  }
}

export async function getOrCreateStackId(opts: {
  ownerId: bigint;
  stackId?: string | null;
  stackName?: string | null;
  isPublic?: boolean;
}) {
  const { ownerId, stackId, stackName, isPublic } = opts;

  if (stackId) return stackId;

  if (!stackName) return undefined; // caller may be uploading a single PDF with no stack

  // 1) try find existing by composite unique
  const existing = await prisma.stack.findUnique({
    where: { owner_id_name: { owner_id: ownerId, name: stackName } },
  });
  if (existing) return existing.id;

  // 2) create with unique slug; handle race via P2002 fallback
  try {
    const slug = await ensureUniqueSlug(stackName);
    const created = await prisma.stack.create({
      data: { owner_id: ownerId, name: stackName, is_public: !!isPublic, slug },
      select: { id: true },
    });
    return created.id;
  } catch (e: any) {
    // If two requests race, the second may still hit the unique.
    // On P2002, re-read and return the existing record.
    if (e?.code === "P2002") {
      const again = await prisma.stack.findUnique({
        where: { owner_id_name: { owner_id: ownerId, name: stackName } },
        select: { id: true },
      });
      if (again) return again.id;
    }
    throw e;
  }
}
