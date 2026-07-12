import { prisma } from "../lib/prismaclient";

async function check() {
  const design = await prisma.ludicDesign.findFirst({
    where: { 
      deliberationId: "ludics-forest-demo",
      participantId: "Proponent"
    },
    include: { 
      acts: { 
        include: { locus: true },
        orderBy: { orderInDesign: "asc" }
      }
    }
  });
  
  if (!design) {
    console.log("No design found");
    return;
  }
  
  console.log(`Design ${design.id.slice(0,8)} has ${design.acts.length} acts:`);
  design.acts.forEach((act: any) => {
    console.log(`  Act ${act.id.slice(0,8)}: kind=${act.kind}, polarity=${act.polarity}, locusPath=${act.locus?.path || "NULL"}, expr=${(act.expression || "").slice(0, 40)}`);
  });
  
  await prisma.$disconnect();
}

check();
