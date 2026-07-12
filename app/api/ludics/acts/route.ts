export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { appendActs } from "packages/ludics-engine/appendActs";
import { syncToAif, LudicsActionType } from "packages/ludics-engine/aif-sync";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";


const zAppend = z.object({
    designId: z.string(),
    enforceAlternation: z.boolean().optional(),
    syncToAif: z.boolean().optional(), // New: sync to AIF/DialogueMove system
    acts: z.array(z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("PROPER"),
        polarity: z.enum(["P","O"]),
        locusPath: z.string(),
        ramification: z.array(z.string()),
        expression: z.string().optional(),
        meta: z.record(z.any()).optional(),
        additive: z.boolean().optional(),
      }),
      z.object({ 
        kind: z.literal("DAIMON"), 
        locusPath: z.string().optional(), // Optional: locus where daimon closes the branch
        expression: z.string().optional(),
      }),
    ])),
  });
  
  export async function POST(req: NextRequest) {
    const { designId, acts, enforceAlternation, syncToAif: shouldSync } = zAppend.parse(await req.json());
    const transformed = acts.map(a => a.kind === "PROPER"
      ? { kind: "PROPER" as const, polarity: a.polarity, locus: a.locusPath, ramification: a.ramification, expression: a.expression, meta: a.meta, additive: a.additive }
      : { kind: "DAIMON" as const, locus: a.locusPath, expression: a.expression }
    );
    const res = await appendActs(designId, transformed, { enforceAlternation });

    // Optional: Sync to AIF/DialogueMove system
    if (shouldSync && res?.appended?.length) {
      try {
        const design = await prisma.ludicDesign.findUnique({
          where: { id: designId },
          select: { deliberationId: true, participantId: true }
        });
        
        if (design) {
          for (let i = 0; i < acts.length; i++) {
            const act = acts[i];
            const appendedAct = res.appended[i];
            if (!appendedAct) continue;

            // Determine action type for sync
            let actionType: LudicsActionType = "ACK";
            if (act.kind === "DAIMON") {
              actionType = "DAIMON";
            } else if (act.expression?.toLowerCase().includes("ack") || act.expression?.toLowerCase().includes("concede")) {
              actionType = "CONCESSION";
            }

            await syncToAif({
              deliberationId: design.deliberationId,
              actionType,
              actorId: design.participantId ?? (act.kind === "PROPER" ? (act.polarity === "P" ? "Proponent" : "Opponent") : "Proponent"),
              locusPath: act.locusPath ?? "0",
              expression: act.expression,
              ludicActId: appendedAct.actId,
              ludicDesignId: designId,
            }).catch(err => console.warn("[acts] AIF sync failed:", err.message));
          }
        }
      } catch (err: any) {
        console.warn("[acts] Error during AIF sync:", err.message);
      }
    }

    return NextResponse.json(res);
  }