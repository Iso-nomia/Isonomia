export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";
import { z } from "zod";
import slugify from "slugify";

const Body = z.object({
  hostType: z.enum(["article","post","room","stack","card","claim","work"]).default("article"),
  hostId: z.string().min(1),
  tags: z.array(z.string()).optional(),
  title: z.string().optional(),
});

/**
 * Ensure slug is unique by appending counter if needed
 */
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug || 'room';
  let counter = 1;
  
  while (true) {
    const exists = await prisma.agoraRoom.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${baseSlug}-${++counter}`;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { hostType, hostId, tags = [], title = null } = parsed.data;

  // Phase 4 Task 0: Auto-create AgoraRoom + DebateSheet chain
  // This ensures every deliberation has the full chain from creation
  try {
    // Step 1: Create AgoraRoom
    const roomSlug = await ensureUniqueSlug(
      slugify(title?.slice(0, 30) || `room-${Date.now()}`, {
        lower: true,
        strict: true,
      })
    );
    
    const room = await prisma.agoraRoom.create({
      data: {
        slug: roomSlug,
        title: title || `Room ${Date.now()}`,
        summary: null,
        visibility: 'public',
      },
    });
    
    // Step 2: Create Deliberation (linked to room)
    const d = await prisma.deliberation.create({
      data: {
        hostType: hostType as any,
        hostId,
        createdById: String(userId),
        agoraRoomId: room.id,
        title,
        tags: tags || [],
      },
      select: { id: true },
    });
    
    // Step 3: Create synthetic DebateSheet (linked to both deliberation and room)
    await prisma.debateSheet.create({
      data: {
        id: `delib:${d.id}`,
        title: title || `Delib ${d.id.slice(0, 6)}`,
        scope: 'deliberation',
        roles: ['Proponent', 'Opponent', 'Curator'],
        deliberationId: d.id,
        roomId: room.id,
        createdById: String(userId),
      },
    });

    // XRef (if you add the model; see Section 6)
    // await prisma.xRef.create({ data: { fromType: hostType, fromId: hostId, toType:'deliberation', toId: d.id, relation:'discusses' } });

    emitBus("deliberations:created", { id: d.id, hostType, hostId, tags, title });
    return NextResponse.json({ ok: true, id: d.id, redirect: `/deliberation/${d.id}` });
  } catch (error) {
    console.error('[deliberations/spawn] Error creating chain:', error);
    return NextResponse.json(
      { error: 'Failed to create deliberation chain' },
      { status: 500 }
    );
  }
}
