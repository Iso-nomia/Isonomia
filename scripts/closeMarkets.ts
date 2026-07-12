import "dotenv/config";
import { prisma } from "@/lib/prismaclient";

async function main() {
  const idx = process.argv.indexOf("--secret");
  const provided = idx !== -1 ? process.argv[idx + 1] : undefined;
  if (process.env.MARKET_CRON_SECRET && provided !== process.env.MARKET_CRON_SECRET) {
    throw new Error("Invalid secret");
  }
  const now = new Date();
  await prisma.predictionMarket.updateMany({
    where: { closesAt: { lt: now }, state: "OPEN" },
    data: { state: "CLOSED", closedAt: now },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
