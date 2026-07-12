// scripts/backfill-block-thumbnails.ts
import "dotenv/config";
import { prisma } from "@/lib/prismaclient";
import { screenshotPage } from "@/lib/screenshot";
import { uploadFileToSupabase } from "@/lib/utils";

async function main() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const blocks = await prisma.blockManifest.findMany({
    where: { thumbnail: null },
    select: { id: true },
  });
  if (!blocks.length) {
    console.log("No blocks without thumbnails. Done.");
    return;
  }
  console.log(`Backfilling ${blocks.length} blocks…`);

  for (const b of blocks) {
    try {
      const url = `${base}/blocks/${b.id}/preview`;
      const png = await screenshotPage(url);
      const fileName = `blocks/thumb-${b.id}.png`;
      const { fileURL, error } = await uploadFileToSupabase(
        new File([png], fileName, { type: "image/png" })
      );
      if (error) throw error;

      await prisma.blockManifest.update({
        where: { id: b.id },
        data: { thumbnail: fileURL },
      });

      console.log(" ✓", b.id);
    } catch (e) {
      console.warn(" ✗", b.id, e);
    }
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
