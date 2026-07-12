import { prisma } from "@/lib/prismaclient";
import { syncToAif } from "./aif-sync";

export async function endWithDaimon(designId: string, reason: "accept"|"fail"="accept") {
  const design = await prisma.ludicDesign.findUnique({ 
    where: { id: designId },
    select: { id: true, deliberationId: true, participantId: true }
  });
  if (!design) throw new Error("NO_SUCH_DESIGN");

  const last = await prisma.ludicAct.findFirst({ where: { designId }, orderBy: { orderInDesign: "desc" } });
  const order = (last?.orderInDesign ?? 0) + 1;
  const expression = reason === "accept" ? "†(accept)" : "†(fail)";
  
  const act = await prisma.ludicAct.create({
    data: {
      designId, kind: "DAIMON", orderInDesign: order, expression,
    }
  });
  await prisma.ludicDesign.update({ where: { id: designId }, data: { hasDaimon: true } });

  // Sync to AIF/Dialogue systems
  // Use participantId directly, defaulting to "Proponent" if not set
  await syncToAif({
    deliberationId: design.deliberationId,
    actionType: "DAIMON",
    actorId: design.participantId ?? "Proponent",
    locusPath: "0", // Root locus for design-level daimon
    expression,
    ludicActId: act.id,
    ludicDesignId: designId,
  }).catch(err => console.warn("[daimon] AIF sync failed:", err.message));

  return { ok: true, actId: act.id, order };
}
