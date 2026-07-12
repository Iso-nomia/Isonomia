/**
 * Test DDS step computation directly
 */

import { prisma } from "@/lib/prismaclient";
import {
  computeDispute,
  disputesToPlays,
} from "@/packages/ludics-core/dds/correspondence/disp";
import type { DesignForCorrespondence } from "@/packages/ludics-core/dds/correspondence";

const TEST_DELIBERATION_ID = "dds-test-deliberation-001";

async function main() {
  console.log("=== Testing DDS Step Computation ===\n");

  // Load designs
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    include: { acts: { orderBy: { orderInDesign: "asc" } } },
  });

  const posDesign = designs.find((d) => d.participantId === "Proponent");
  const negDesign = designs.find((d) => d.participantId === "Opponent");

  if (!posDesign || !negDesign) {
    console.log("No P/O pair found");
    await prisma.$disconnect();
    return;
  }

  console.log("Pos Design:", posDesign.id.slice(-8), `(${posDesign.acts.length} acts)`);
  console.log("Neg Design:", negDesign.id.slice(-8), `(${negDesign.acts.length} acts)`);

  // Load loci
  const loci = await prisma.ludicLocus.findMany({
    where: { dialogueId: TEST_DELIBERATION_ID },
  });
  const lociMap = new Map(loci.map((l) => [l.id, l.path]));

  // Build acts
  const mapActs = (acts: any[]) =>
    acts.map((a: any) => ({
      id: a.id,
      designId: a.designId,
      kind: "INITIAL" as const,
      polarity: a.polarity as "P" | "O",
      locusPath: lociMap.get(a.locusId) || "0",
      ramification: (a.subLoci as string[]) || [],
    }));

  const posForCorr: DesignForCorrespondence = {
    id: posDesign.id,
    deliberationId: TEST_DELIBERATION_ID,
    participantId: "Proponent",
    acts: mapActs(posDesign.acts),
    loci: [],
  };

  const negForCorr: DesignForCorrespondence = {
    id: negDesign.id,
    deliberationId: TEST_DELIBERATION_ID,
    participantId: "Opponent",
    acts: mapActs(negDesign.acts),
    loci: [],
  };

  // Show acts
  console.log("\nPos acts:");
  posForCorr.acts.forEach((a) => {
    console.log(`  ${a.polarity} @ ${a.locusPath}`);
  });
  console.log("\nNeg acts:");
  negForCorr.acts.forEach((a) => {
    console.log(`  ${a.polarity} @ ${a.locusPath}`);
  });

  // Compute dispute
  const dispute = computeDispute(posForCorr, negForCorr);

  if (dispute) {
    console.log("\n=== Dispute Computed ===");
    console.log("Status:", dispute.status);
    console.log("Pairs:", dispute.pairs.length);
    dispute.pairs.forEach((p, i) => {
      const posId = p.posActId ? p.posActId.slice(-8) : "∅";
      const negId = p.negActId ? p.negActId.slice(-8) : "∅";
      console.log(`  [${i}] ${p.locusPath}: P=${posId} O=${negId}`);
    });

    const plays = disputesToPlays([dispute], "P");
    console.log("\nPlays:", plays.length);
    plays.slice(0, 7).forEach((p, i) => {
      const seq = p.sequence.map((s) => `${s.locusPath}:${s.polarity}`).join("|");
      console.log(`  [${i}] ${seq}`);
    });
  } else {
    console.log("\nNo dispute computed (designs may not interact)");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
