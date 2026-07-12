import { prisma } from "@/lib/prismaclient";
import { Hooks } from "./hooks";
import { endWithDaimon } from "./daimon";
import { syncToAif } from "./aif-sync";

export async function closeBranch(targetDesignId: string, locusPath: string) {
  const design = await prisma.ludicDesign.findUnique({ where: { id: targetDesignId } });
  if (!design) throw new Error("NO_SUCH_DESIGN");
  const locus = await prisma.ludicLocus.findFirst({ where: { dialogueId: design.deliberationId, path: locusPath } });
  if (!locus) throw new Error("NO_SUCH_LOCUS");

  // Minimal "close branch": append a DAIMON at target locus' design or clear ramifications upstream
  const last = await prisma.ludicAct.findFirst({ where: { designId: targetDesignId }, orderBy: { orderInDesign: "desc" }});
  const order = (last?.orderInDesign ?? 0) + 1;

  const act = await prisma.ludicAct.create({
    data: { designId: targetDesignId, kind: "DAIMON", orderInDesign: order, expression: "BRANCH_CLOSED" }
  });
  await prisma.ludicChronicle.create({ data: { designId: targetDesignId, order, actId: act.id } });

  Hooks.emitActAppended({
    designId: targetDesignId,
    dialogueId: design.deliberationId,
    actId: act.id,
    orderInDesign: order,
    act: { kind: "DAIMON", expression: "BRANCH_CLOSED" },
  });

  // Sync to AIF/Dialogue systems
  // Determine actor based on participantId (Proponent/Opponent) or default to Opponent for branch close
  const actorId = design.participantId === "Proponent" ? "Opponent" : "Proponent";
  await syncToAif({
    deliberationId: design.deliberationId,
    actionType: "BRANCH_CLOSE",
    actorId,
    locusPath,
    expression: "BRANCH_CLOSED",
    ludicActId: act.id,
    ludicDesignId: targetDesignId,
  }).catch(err => console.warn("[judge] AIF sync failed for closeBranch:", err.message));

  return { appended: [act.id] };
}

export async function forceConcession(params: {
  dialogueId: string; judgeId: string; targetDesignId: string; locus: string; text: string;
  targetClaimId?: string; // Optional: claim being conceded
}) {
  const { dialogueId, targetDesignId, locus, text, targetClaimId } = params;
  const design = await prisma.ludicDesign.findUnique({ where: { id: targetDesignId } });
  if (!design) throw new Error("NO_SUCH_DESIGN");

  // Force a (+ then -) micro-pattern at the locus (simplified)
  // For demo purposes we only append a negative ACK on the target design.
  const targetLocus = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: locus } });
  if (!targetLocus) throw new Error("NO_SUCH_LOCUS");

  const last = await prisma.ludicAct.findFirst({ where: { designId: targetDesignId }, orderBy: { orderInDesign: "desc" }});
  const order = (last?.orderInDesign ?? 0) + 1;

  const act = await prisma.ludicAct.create({
    data: {
      designId: targetDesignId, kind: "PROPER", polarity: "O",
      locusId: targetLocus.id, ramification: [], expression: text, orderInDesign: order
    }
  });
  await prisma.ludicChronicle.create({ data: { designId: targetDesignId, order, actId: act.id } });
  await endWithDaimon(targetDesignId, "fail"); // loser forced to daimon

  Hooks.emitActAppended({
    designId: targetDesignId,
    dialogueId,
    actId: act.id,
    orderInDesign: order,
    act: { kind: "PROPER", polarity: "O", locusPath: locus, expression: text },
  });

  // Try to find a claim if not provided
  let claimId = targetClaimId;
  if (!claimId && text) {
    const matchingClaim = await prisma.claim.findFirst({
      where: { deliberationId: dialogueId, text },
      select: { id: true },
    });
    if (matchingClaim) claimId = matchingClaim.id;
  }

  // Sync to AIF/Dialogue systems with commitment edge
  await syncToAif({
    deliberationId: dialogueId,
    actionType: "FORCE_CONCESSION",
    actorId: "Opponent", // Force concession is always O acknowledging P
    locusPath: locus,
    expression: text,
    targetClaimId: claimId,
    ludicActId: act.id,
    ludicDesignId: targetDesignId,
  }).catch(err => console.warn("[judge] AIF sync failed for forceConcession:", err.message));

  // If you update CS here, also emit Hooks.emitCSUpdated(...)

  return { appended: [act.id] };
}
