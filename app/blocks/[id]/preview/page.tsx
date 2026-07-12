// app/blocks/[id]/preview/page.tsx
import { prisma } from "@/lib/prismaclient";
import BlockPreviewClient from "@/components/blocks/BlockPreviewClient";

export const dynamic = "force-dynamic";

export default async function BlockPreviewPage({ params: { id } }: { params: { id: string } }) {
  const row = await prisma.blockManifest.findUnique({
    where: { id },
    select: { id: true, component: true, props: true },
  });

  if (!row) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <div className="text-sm text-slate-600">Block not found</div>
      </div>
    );
  }

  // fixed canvas so screenshots are consistent (tweak to taste)
  return (
    <div className="grid min-h-screen place-items-center bg-white">
      <div
        className="relative bg-white shadow rounded"
        style={{ width: 640, height: 400, overflow: "hidden" }}
      >
        <BlockPreviewClient component={row.component} props={row.props as any} />
      </div>
    </div>
  );
}
