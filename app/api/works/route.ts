// app/api/works/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { jsonSafe } from '@/lib/bigintjson';
import { getCurrentUserId } from '@/lib/serverutils';
import { customAlphabet } from 'nanoid';
const PAGE_SIZE = 20; // Default page size for pagination
export const dynamic = 'force-dynamic';

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);


function slugifyTitle(s: string) {
  return s.toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'work';
}
async function makeUniqueSlug(base: string) {
  let slug = base || 'work';
  let trySlug = slug;
  let i = 2;
  // Use findUnique if slug is UNIQUE, else fallback to count()
  while (true) {
    const exists = await prisma.theoryWork.findUnique({ where: { slug: trySlug } })
      .then(Boolean)
      .catch(async () => (await prisma.theoryWork.count({ where: { slug: trySlug } })) > 0);
    if (!exists) return trySlug;
    trySlug = `${slug}-${i++}`;
    if (i > 99) return `${slug}-${nano()}`;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const deliberationId = sp.get('deliberationId') ?? undefined;
  const authorId       = sp.get('authorId') ?? undefined;
  const theoryType     = sp.get('theoryType') as ('DN'|'IH'|'TC'|'OP'|null) ?? null;
  const withIntegrity = sp.get('withIntegrity') === '1';


  const where: any = {};
  if (deliberationId) where.deliberationId = deliberationId;
  if (authorId) where.authorId = authorId;
  if (theoryType) where.theoryType = theoryType;


  
const works = await prisma.theoryWork.findMany({
  where,
  select: {
    id: true, title: true, slug: true,
    theoryType: true, standardOutput: true, authorId: true,
    status: true, visibility: true, publishedAt: true, createdAt: true
  },
  orderBy: { createdAt: 'desc' },
});

  if (!withIntegrity || !works.length) return NextResponse.json({ ok:true, works });

  const integ = await Promise.all(
    works.map(w => fetch(new URL(`/api/works/${w.id}/integrity`, req.url)).then(r=>r.json()).catch(()=>null))
  );
  const byId = new Map(works.map((w,i) => [w.id, integ[i]]));
  return NextResponse.json({ ok:true, works: works.map(w => ({ ...w, integrity: byId.get(w.id) })) });
}
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    title = 'Untitled Work',
    theoryType = 'IH',
    deliberationId: incomingDeliberationId = null,
    standardOutput = null,
    // optional: allow callers to attach to a room; we’ll inherit its representationRule
    roomId = null as string | null,
  } = body ?? {};

  // 1) slug
  const slug = await makeUniqueSlug(slugifyTitle(String(title || '')));

  // 2) ensure deliberation (connect if provided; else create with required fields)
  let deliberationId: string;
  if (incomingDeliberationId) {
    deliberationId = String(incomingDeliberationId);
  } else {
    // AgoraRoom has no representation rule to inherit; fallback 'utilitarian'
    const rule: 'utilitarian' | 'harmonic' | 'maxcov' = 'utilitarian';

    const created = await prisma.deliberation.create({
      data: {
        hostType: 'work',
        hostId: slug,
        roomId: roomId ?? undefined,
        createdById: String(userId),
        rule,
      },
      select: { id: true },
    });
    deliberationId = created.id;
  }

  // 3) create work and connect deliberation
  const work = await prisma.theoryWork.create({
    data: {
      title,
      slug,
      theoryType,
      authorId: String(userId),
      standardOutput,
      body: '',
      deliberation: { connect: { id: deliberationId } },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      theoryType: true,
      authorId: true,
      deliberationId: true,
    },
  });

  return NextResponse.json(jsonSafe({ work }), { status: 201 });
}