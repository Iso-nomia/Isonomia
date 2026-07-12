export const runtime = "nodejs"; // 👈 add at top

import { NextRequest, NextResponse } from "next/server";
import { fetchMessages, sendMessage } from "@/lib/actions/message.actions";
import { prisma } from "@/lib/prismaclient";
import { supabase } from "@/lib/supabaseclient";
import { ensureParticipant } from "../ensureParticipant";
import { jsonSafe } from "@/lib/bigintjson";


// ...inside POST after calling sendMessage (unchanged)...


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const conversationId = BigInt(params.id);
  const userCheck = await ensureParticipant(req, conversationId);
  if (userCheck instanceof NextResponse) return userCheck;

  const cursorParam = req.nextUrl.searchParams.get("cursor");
  const limitParam  = req.nextUrl.searchParams.get("limit");
  const cursor = cursorParam ? BigInt(cursorParam) : undefined;
  const limit  = limitParam ? parseInt(limitParam, 10) : undefined;

  const rows = await fetchMessages({ conversationId, cursor, limit });
  const topLevel = rows.filter((m) => m.drift_id == null);

  // Map to UI shape, then jsonSafe
  const payload = topLevel.map(m => ({
    id: m.id,
    text: m.text,
    createdAt: m.created_at,
    senderId: m.sender_id,
    isRedacted: m.is_redacted,
    meta: m.meta,                // lets the client see DRIFT_ANCHOR immediately
    driftId: m.drift_id,         // consistency with the rest of your DTOs
    sender: { name: m.sender.name, image: m.sender.image },
    
    attachments: m.is_redacted ? [] : m.attachments.map(a => ({
      id: a.id,
      path: a.path,
      type: a.type,
      size: a.size,
    })),
  }));

  return NextResponse.json(jsonSafe(payload), { status: 200 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
      try {
          const conversationId = BigInt(params.id);
          const userCheck = await ensureParticipant(req, conversationId);
          if (userCheck instanceof NextResponse) return userCheck;
          const { userId } = userCheck;
      
          const form = await req.formData();
          const text = form.get("text") as string | null;
          const files = form.getAll("files").filter(Boolean) as File[];
          const driftIdIn = form.get("driftId") as string | null;
          //const clientId = (form.get("clientId") as string | null) ?? undefined;
             const clientId =
     (form.get("clientId") as string | null)
     ?? req.headers.get("x-idempotency-key")
     ?? undefined;

           // NEW: accept optional meta (stringified JSON)
           const metaRaw = form.get("meta");

    let meta: any | undefined = undefined;
    if (typeof metaRaw === "string" && metaRaw.trim().length) {
      try { meta = JSON.parse(metaRaw); } catch {}
    }

          const saved = await sendMessage({
            conversationId,
            senderId: userId,
            text: text ?? undefined,
            files: files.length ? files : undefined,
            driftId: driftIdIn ? BigInt(driftIdIn) : undefined,
            clientId,
            meta, 
          });
            //  try {
            //      const saved = await sendMessage({
            //        conversationId,
            //        senderId: userId,
            //        text: text ?? undefined,
            //        files: files.length ? files : undefined,
            //        driftId: driftIdIn ? BigInt(driftIdIn) : undefined,
            //        clientId,
            //        meta,
            //      });
            //      return NextResponse.json({ id: String(saved.id), driftId: saved.driftId ? String(saved.driftId) : null }, { status: 201 });
            //    } catch (e:any) {
            //      // If client_id collided, surface the existing row
            //      if (e?.code === "P2002" && String(e?.meta?.target || "").includes("message_client_id_key") && clientId) {
            //        const existing = await prisma.message.findFirst({
            //          where: { client_id: clientId },
            //          select: { id: true, drift_id: true },
            //        });
            //        if (existing) {
            //          return NextResponse.json({ id: String(existing.id), driftId: existing.drift_id ? String(existing.drift_id) : null }, { status: 200 });
            //        }
            //      }
            //      throw e;
            //    }
      
          // Coerce id to BigInt for Prisma in case sendMessage returned a string.
          const savedId = typeof (saved as any).id === "bigint"
            ? (saved as any).id
            : BigInt((saved as any).id);
      
          // Small retry: attachment rows can lag a tick after message insert.
          async function readFullMessage(retries = 2) {
            for (let i = 0; i <= retries; i++) {
            const full = await prisma.message.findUnique({
              where: { id: savedId },
                include: {
                  sender: { select: { name: true, image: true } },
                  attachments: { select: { id: true, path: true, type: true, size: true } },
                },
              });
              if (full && (i === retries || full.attachments)) return full;
              await new Promise(r => setTimeout(r, 25));
            }
            return null;
          }
      
          const full = await readFullMessage();
          if (!full) {
            return NextResponse.json({ ok: false, error: "Message not found after save" }, { status: 500 });
          }
      
          const dto = {
            id: full.id.toString(),
            text: full.text ?? null,
            createdAt: full.created_at.toISOString(),
            senderId: full.sender_id.toString(),
            driftId: full.drift_id ? full.drift_id.toString() : null,
            clientId: clientId ?? null,
            isRedacted: Boolean(full.is_redacted),
            sender: { name: full.sender.name, image: full.sender.image },
            attachments: full.is_redacted ? [] : full.attachments.map((a) => ({
              id: a.id.toString(),
              path: a.path,
              type: a.type,
              size: a.size,
            })),
          };
      
          // Do NOT broadcast from server here. Your existing realtime path can handle it.
          // If you must broadcast here, do it fire-and-forget (and ensure your supabase client supports ws on server):
          // supabase.channel(`conversation-${params.id}`).send({ type: "broadcast", event: "new_message", payload: dto }).catch(()=>{});
      
          return NextResponse.json(dto, { status: 201 });
        } catch (e: any) {
          console.error("POST /api/messages/:id failed", e);
          return NextResponse.json({ ok: false, error: e?.message || "Internal Server Error" }, { status: 500 });
        }
}
