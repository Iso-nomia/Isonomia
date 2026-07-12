import { prisma } from "@/lib/prismaclient";
import { appendActs } from "./appendActs";
import { applyToCS } from "./commitments";
import { syncToAif } from "./aif-sync";

export async function concede(params: {
  dialogueId: string,
  concedingParticipantId: string,         // "Proponent" | "Opponent"
  anchorLocus: string,                     // L
  proposition: { text: string, baseLocus?: string, claimId?: string }, // P at L, optionally with claimId
}) {
  const { dialogueId, concedingParticipantId, anchorLocus, proposition } = params;

  // Find the conceding side's design
  const design = await prisma.ludicDesign.findFirst({
    where: { deliberationId: dialogueId, participantId: concedingParticipantId }
  });
  if (!design) throw new Error("NO_SUCH_DESIGN");

  // (+, L, {L.1}, "P") then (-, L.1, [], "ACK")
  const child = `${anchorLocus}.1`;
  const result = await appendActs(design.id, [
    { kind: "PROPER", polarity: "P", locus: anchorLocus, ramification: ["1"], expression: proposition.text },
    { kind: "PROPER", polarity: "O", locus: child,       ramification: [],    expression: "ACK" },
  ], { enforceAlternation: false });

  // Update commitment state for THE OTHER side (they now "have" P)
  const receiver = concedingParticipantId === "Proponent" ? "Opponent" : "Proponent";
  await applyToCS(dialogueId, receiver, {
    add: [{ label: proposition.text, basePolarity: "pos", baseLocusPath: proposition.baseLocus ?? "0" }]
  });

  // Try to find the claimId if not provided
  let claimId = proposition.claimId;
  if (!claimId && proposition.text) {
    // Try to find a claim with matching text in this deliberation
    const matchingClaim = await prisma.claim.findFirst({
      where: {
        deliberationId: dialogueId,
        text: proposition.text,
      },
      select: { id: true },
    });
    if (matchingClaim) {
      claimId = matchingClaim.id;
    }
  }

  // Sync to AIF/Dialogue systems with commitment edge creation
  const firstActId = result?.appended?.[0]?.actId;
  await syncToAif({
    deliberationId: dialogueId,
    actionType: "CONCESSION",
    actorId: concedingParticipantId,
    locusPath: anchorLocus,
    expression: proposition.text,
    targetClaimId: claimId,
    ludicActId: firstActId,
    ludicDesignId: design.id,
  }).catch(err => console.warn("[concession] AIF sync failed:", err.message));

  return { ok: true, appended: 2, anchorLocus, child };
}
