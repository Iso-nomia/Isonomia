import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function inspect() {
  const argumentId = "cmhpnanv000yog1t914o7tsif";
  
  console.log("\n=== Inspecting Argument ===");
  console.log("ID:", argumentId);
  
  // Check raw argument record
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
  });
  
  console.log("\nRaw Argument:");
  console.log(JSON.stringify(arg, null, 2));
  
  // Check with claim relation
  const argWithClaim = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: { claim: true },
  });
  
  console.log("\nWith claim relation:");
  console.log("claimId field:", argWithClaim?.claimId);
  console.log("claim object:", argWithClaim?.claim ? "EXISTS" : "NULL");
  if (argWithClaim?.claim) {
    console.log("claim.id:", argWithClaim.claim.id);
    console.log("claim.text:", argWithClaim.claim.text?.slice(0, 100));
  }
  
  // Check if claimId exists in database
  if (arg?.claimId) {
    const claim = await prisma.claim.findUnique({
      where: { id: arg.claimId },
    });
    console.log("\nDirect claim lookup:");
    console.log("Claim exists:", !!claim);
    if (claim) {
      console.log("Claim text:", claim.text?.slice(0, 100));
    }
  }
  
  // Check argument schemes
  const schemes = await prisma.argumentSchemeInstance.findMany({
    where: { argumentId },
    include: {
      scheme: {
        include: {
          cqs: true,
        },
      },
    },
  });
  
  console.log("\n=== Argument Schemes ===");
  console.log("Count:", schemes.length);
  schemes.forEach((s, idx) => {
    console.log(`\n[${idx + 1}] ${s.scheme.key} (${s.scheme.name})`);
    console.log("    CQs:", s.scheme.cqs.length);
  });
  
  await prisma.$disconnect();
}

inspect().catch((e) => {
  console.error(e);
  process.exit(1);
});
