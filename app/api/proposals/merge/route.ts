// app/api/proposals/merge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { versionHashOf } from "@/lib/receipts/hash";   // sha256 over canonicalized payload
import { signReceipt } from "@/lib/receipts/sign";     // returns { signature, keyId }
import { checkMergeAllowed, DefaultMergePolicy } from "@/lib/gitchat/policies";

export const runtime = "nodejs";

const bodySchema = z.object({
  rootMessageId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v)),
  proposalMessageId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v)).optional(),
  facetId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v)).optional(),
});

// pragmatic local gate: owner/mod/proposal author
async function canMergeLocal({
  rootMessageId,
  userId,
  proposalMessageId,
}: {
  rootMessageId: bigint;
  userId: bigint;
  proposalMessageId?: bigint;
}) {
  const root = await prisma.message.findUnique({
    where: { id: rootMessageId },
    select: { sender_id: true, conversation_id: true },
  });
  if (!root) return false;

  // 1) root author
  if (root.sender_id === userId) return true;

  // 2) mods/admins (if roles exist)
  const part = await prisma.conversationParticipant.findFirst({
    where: { conversation_id: root.conversation_id, user_id: userId },
    select: { role: true } as any,
  });
  const role = (part as any)?.role as string | undefined;
  if (role && ["ADMIN", "MOD", "OWNER"].includes(role.toUpperCase())) return true;

  // 3) dev flag: any participant
  if (process.env.MERGE_ALLOW_PARTICIPANTS === "true" && part) return true;

  // 4) proposal author (when merging from proposalMessageId)
  if (proposalMessageId) {
    const prop = await prisma.message.findUnique({
      where: { id: proposalMessageId },
      select: { drift: { select: { created_by: true } } },
    });
    if (prop?.drift?.created_by && prop.drift.created_by === userId) return true;
  }

  return false;
}

/** Clone a facet to the root message and set it as default via SheafMessageMeta. */
async function cloneFacetToRoot(rootMessageId: bigint, facetId: bigint) {
  const facet = await prisma.sheafFacet.findUnique({
    where: { id: facetId },
    select: {
      id: true,
      audienceKind: true,
      audienceMode: true,
      audienceRole: true,
      audienceListId: true,
      snapshotMemberIds: true,
      listVersionAtSend: true,
      audienceUserIds: true,
      sharePolicy: true,
      expiresAt: true,
      body: true,
      priorityRank: true,
      visibilityKey: true,
    },
  } as any);
  if (!facet) throw new Error("facet not found");

  const newFacet = await prisma.sheafFacet.create({
    data: {
      messageId: rootMessageId,
      audienceKind: facet.audienceKind,
      audienceMode: facet.audienceMode,
      audienceRole: facet.audienceRole,
      audienceListId: facet.audienceListId,
      snapshotMemberIds: facet.snapshotMemberIds ?? [],
      listVersionAtSend: facet.listVersionAtSend ?? null,
      audienceUserIds: facet.audienceUserIds ?? [],
      sharePolicy: facet.sharePolicy,
      expiresAt: facet.expiresAt ?? null,
      body: facet.body,
      priorityRank: facet.priorityRank ?? 0,
      visibilityKey: facet.visibilityKey ?? null,
    } as any,
  });

  // Upsert SheafMessageMeta.defaultFacetId
  await prisma.sheafMessageMeta.upsert({
    where: { messageId: rootMessageId },
    update: { defaultFacetId: newFacet.id },
    create: { messageId: rootMessageId, defaultFacetId: newFacet.id },
  });

  // Canonical payload for hashing
  const facetPayload = { type: "facet", body: facet.body };
  return { newFacetId: newFacet.id as any, facetPayload };
}

export async function POST(req: NextRequest) {
  const me = await getUserFromCookies();
  if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { rootMessageId, proposalMessageId, facetId } = bodySchema.parse(await req.json());

  // 1) policy gate (room/conversation)
  const allowed = await checkMergeAllowed(DefaultMergePolicy, me.userId, rootMessageId);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  // 2) pragmatic local gate
  if (!(await canMergeLocal({ rootMessageId, userId: me.userId, proposalMessageId }))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    // root message (for conversation id)
    const root = await prisma.message.findUnique({
      where: { id: rootMessageId },
      select: { id: true, conversation_id: true },
    });
    if (!root) return new NextResponse("Not found", { status: 404 });
  
    let mergedFromMessageId: string | null = null;
    let versionHash = "";
    let fromFacetIds: string[] = [];
    let snapshot: any = null; // <— define once
  
    if (facetId) {
      // FACET merge
      const facet = await prisma.sheafFacet.findUnique({
        where: { id: facetId },
        select: {
          id: true,
          audienceKind: true,
          audienceMode: true,
          audienceRole: true,
          audienceListId: true,
          snapshotMemberIds: true,
          listVersionAtSend: true,
          audienceUserIds: true,
          sharePolicy: true,
          expiresAt: true,
          body: true,
          priorityRank: true,
          visibilityKey: true,
        },
      } as any);
      if (!facet) return new NextResponse("facet not found", { status: 400 });
  
      const newFacet = await prisma.sheafFacet.create({
        data: {
          messageId: rootMessageId,
          audienceKind: facet.audienceKind,
          audienceMode: facet.audienceMode,
          audienceRole: facet.audienceRole,
          audienceListId: facet.audienceListId,
          snapshotMemberIds: facet.snapshotMemberIds ?? [],
          listVersionAtSend: facet.listVersionAtSend ?? null,
          audienceUserIds: facet.audienceUserIds ?? [],
          sharePolicy: facet.sharePolicy,
          expiresAt: facet.expiresAt ?? null,
          body: facet.body,
          priorityRank: facet.priorityRank ?? 0,
          visibilityKey: facet.visibilityKey ?? null,
        } as any,
      });
  
      // default facet via SheafMessageMeta
      await prisma.sheafMessageMeta.upsert({
        where: { messageId: rootMessageId },
        update: { defaultFacetId: newFacet.id },
        create: { messageId: rootMessageId, defaultFacetId: newFacet.id },
      });
  
      const facetPayload = { type: "facet", body: facet.body };
      versionHash = versionHashOf(facetPayload);
      snapshot = facetPayload;              // <— set snapshot here
      fromFacetIds = [String(facetId)];
      mergedFromMessageId = null;
    } else {
      // TEXT merge
      const candidate = await prisma.message.findUnique({
        where: { id: proposalMessageId! },
        select: { id: true, text: true },
      });
      if (!candidate || !candidate.text) {
        return new NextResponse("No mergeable text", { status: 400 });
      }
  
      await prisma.message.update({
        where: { id: rootMessageId },
        data: { text: candidate.text, edited_at: new Date() as any },
      });
  
      const textPayload = { type: "text", text: candidate.text.trim() };
      versionHash = versionHashOf(textPayload);
      snapshot = textPayload;               // <— set snapshot here
      mergedFromMessageId = candidate.id.toString();
    }
  
    // Parent linkage (latest by time)
    const lastReceipt = await prisma.mergeReceipt.findFirst({
      where: { message_id: root.id },
      orderBy: [{ merged_at: "desc" }, { id: "desc" }],
      select: { version_hash: true },
    });
  
    // approvals/blocks (only meaningful for facet merges)
    let approvals: any[] = [];
    let blocks: any[] = [];
    if (fromFacetIds.length > 0) {
      const sigRows = await prisma.proposalSignal.findMany({
        where: { message_id: root.id, facet_id: { in: fromFacetIds } },
        select: { user_id: true, kind: true, created_at: true },
      });
      approvals = sigRows
        .filter((r) => r.kind === "APPROVE")
        .map((r) => ({
          userId: r.user_id.toString(),
          role: "member",
          at: r.created_at.toISOString(),
        }));
      blocks = sigRows
        .filter((r) => r.kind === "BLOCK")
        .map((r) => ({
          userId: r.user_id.toString(),
          role: "member",
          at: r.created_at.toISOString(),
        }));
    }
  // Receipt body & signature (v is computed by the /receipts API)
const receiptBody = {
  messageId: root.id.toString(),
  versionHash,
  parents: lastReceipt?.version_hash ? [lastReceipt.version_hash] : [],
  // fromFacetIds: <— REMOVE from signed body (or don’t include at all)
  mergedBy: me.userId.toString(),
  mergedAt: new Date().toISOString(),
  policy: { id: "owner-or-mod@v1", quorum: null, minApprovals: null, timeoutSec: null },
  approvals,
  blocks,
  prevReceiptHash: lastReceipt?.version_hash || null,
  snapshot, // {type:"text", text:"..."} or {type:"facet", body:{...}}
};
const { signature } = signReceipt(receiptBody);

await prisma.mergeReceipt.create({
  data: {
    message_id: root.id,
    version_hash: versionHash,
    parents: receiptBody.parents as any,
    // from_facet_ids: <— REMOVE this line (field does not exist in schema)
    merged_by: me.userId,
    merged_at: new Date(receiptBody.mergedAt),
    policy_id: receiptBody.policy.id,
    approvals: approvals as any,
    blocks: blocks as any,
    prev_receipt_hash: receiptBody.prevReceiptHash,
    signature,
    snapshot: snapshot as any,
  },
});
  
    // Broadcast so open UIs refresh
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await admin
        .channel(`conversation-${root.conversation_id.toString()}`)
        .send({
          type: "broadcast",
          event: "proposal_merge",
          payload: { rootMessageId: root.id.toString(), versionHash },
        });
    } catch (e) {
      console.warn("[ap] proposal_merge broadcast failed", e);
    }
  
    // System note
    try {
      const count = await prisma.mergeReceipt.count({ where: { message_id: rootMessageId } });
      await prisma.message.create({
        data: {
          conversation_id: root.conversation_id,
          sender_id: me.userId,
          text: `Merged to v${count} by user ${me.userId}`,
          meta: { kind: "MERGE_NOTE", rootMessageId: rootMessageId.toString() } as any,
        },
      });
    } catch {}
  
    return NextResponse.json({
      ok: true,
      mode: facetId ? "FACET" : "TEXT",
      mergedFromMessageId,
      versionHash,
    });
  } catch (e: any) {
    console.error("[proposals/merge] error", e);
    return new NextResponse("Merge failed", { status: 500 });
  }
}
