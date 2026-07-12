import "dotenv/config";
import { hybridSearchArguments } from "@/lib/argument/hybridSearch";
import { prisma } from "@/lib/prismaclient";

async function main() {
  const queries = [
    "smartphones teen mental health",
    "expert opinion on adolescent depression",
    "social media causation",
  ];
  for (const q of queries) {
    console.log(`\n=== ${q} ===`);
    const t0 = Date.now();
    const out = await hybridSearchArguments({ query: q, limit: 5 });
    const ms = Date.now() - t0;
    console.log(`took ${ms}ms, ${out.length} results`);
    for (const r of out) {
      console.log(
        `  ${r.id}  rrf=${r.rrfScore.toFixed(4)}  sparse=${r.sparseRank ?? "-"}  dense=${r.denseRank ?? "-"}  cov=${r.lexicalCoverage}  dist=${r.denseDistance?.toFixed(3) ?? "-"}`,
      );
    }
  }
  await prisma.$disconnect();
}
main().catch(e=>{console.error(e); process.exit(1);});
