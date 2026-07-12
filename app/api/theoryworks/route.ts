import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getUserFromCookies } from '@/lib/serverutils';

export const dynamic = 'force-dynamic'; // avoid caching the route

// No authorId here — server decides user from cookies
const Create = z.object({
  deliberationId: z.string().min(1),
  title: z.string().min(3, 'Title must be at least 3 chars'),
  body: z.string().min(1, 'Body cannot be empty'),
  theoryType: z.enum(['DN','IH','TC','OP']).optional(),     // opt-in
  standardOutput: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  // 1) derive user from Firebase cookies
  const user = await getUserFromCookies();
  if (!user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Your userId is bigint in DB; TheoryWork.authorId is String → stringify
  const authorIdStr = user.userId.toString();

  // 2) parse body
  let json: any;
  try { json = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = Create.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { deliberationId, title, body, theoryType, standardOutput } = parsed.data;

  // 3) sanity: deliberation must exist (avoid FK/RLS surprises)
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!delib) {
    return NextResponse.json({ error: 'Deliberation not found' }, { status: 404 });
  }

  // 4) create work
  try {
    const slug = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80)}-${Math.random().toString(36).slice(2, 8)}`;

    const work = await prisma.theoryWork.create({
      data: {
        deliberationId,
        authorId: authorIdStr,                      // ← derived from cookie session
        slug,
        title,
        body,
        theoryType: theoryType ?? "OP",             // required enum; default when not supplied
        standardOutput: standardOutput ?? null,
      },
    });

    return NextResponse.json({ ok: true, work }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/theoryworks] error:', err?.message || err);
    return NextResponse.json(
      { error: 'Server error', message: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
