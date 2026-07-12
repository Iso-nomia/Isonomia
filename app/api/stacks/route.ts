export const dynamic = "force-dynamic";

import { prisma } from '@/lib/prismaclient';
import { NextResponse } from 'next/server';
import { getUserFromCookies, getCurrentUserId } from '@/lib/serverutils';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export async function GET(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const page     = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('pageSize') || '20', 10), 1), 100);
  const q        = (url.searchParams.get('q') || '').trim();
  const vis      = (url.searchParams.get('vis') || 'ALL') as 'ALL' | 'PUBLIC' | 'PRIVATE';
  const sort     = url.searchParams.get('sort') || 'created_at:desc';

  const [field, dir] = sort.split(':') as [string, 'asc' | 'desc'];
  const orderBy = [
    { [field || "created_at"]: (dir === "asc" ? "asc" : "desc") as "asc" | "desc" },
    { id: "desc" as "asc" | "desc" }
  ];

  const ownerId = BigInt(user.userId ?? 0);
  const where: any = {
    owner_id: ownerId,
    ...(vis === 'PUBLIC' ? { is_public: true } : {}),
    ...(vis === 'PRIVATE' ? { is_public: false } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ] } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.stack.count({ where }),
    prisma.stack.findMany({
      where, orderBy, take: pageSize, skip: (page - 1) * pageSize,
      select: { id:true, name:true, slug:true, is_public:true, created_at:true, description:true },
    }),
  ]);

  const items = rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug ?? '',
    is_public: r.is_public,
    created_at: r.created_at.toISOString(),
    description: r.description ?? null,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  is_public: z.boolean().optional(),
  visibility: z.enum(["public_open", "public_closed", "private", "unlisted"]).optional(),
  description: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  // Cookie or Bearer auth (Bearer needed by orchestrator bots / extension).
  let userId: bigint | null = null;
  const cookieUser = await getUserFromCookies();
  if (cookieUser?.userId) {
    userId = BigInt(cookieUser.userId);
  } else {
    userId = await getCurrentUserId();
  }
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const safe = await req.json().catch(() => ({} as unknown));
  const parsed = CreateSchema.safeParse(safe);

  const {
    name = 'Untitled Stack',
    slug = nanoid(),
    is_public = false,
    visibility = "private",
    description = null,
  } = parsed.success ? parsed.data : {};

  // Derive is_public from visibility for backward compatibility
  const computedIsPublic = visibility === "public_open" || visibility === "public_closed" || visibility === "unlisted";

  const stack = await prisma.stack.create({
    data: {
      owner_id: userId,
      name, 
      slug, 
      is_public: computedIsPublic,
      visibility,
      description,
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json({ id: stack.id, slug: stack.slug }, { status: 201 });
}
