import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { screenshotPage } from "@/lib/screenshot";
import { uploadFileToSupabase } from "@/lib/utils";
import { getUserFromCookies } from "@/lib/server/getUser";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  // (Optional) auth gate – keep dev-friendly by not failing hard if getUserFromCookies() isn’t set up.
  const user = await getUserFromCookies().catch(() => null);
  // If you want to enforce ownership here, uncomment:
  // const row = await prisma.blockManifest.findUnique({ where: { id }, select: { ownerId: true } });
  // if (!row || (user?.id && BigInt(user.id) !== row.ownerId)) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL not configured" }, { status: 500 });
  const previewUrl = `${base}/blocks/${id}/preview`;

  try {
    const png = await screenshotPage(previewUrl);
    const fileName = `blocks/thumb-${id}.png`;

    const { fileURL: thumbnail, error } = await uploadFileToSupabase(
      new File([new Uint8Array(png)], fileName, { type: "image/png" })
    );
    if (error || !thumbnail) return NextResponse.json({ error: String(error) }, { status: 500 });

    await prisma.blockManifest.update({
      where: { id },
      data: { thumbnail },
    });

    return NextResponse.json({ thumbnail });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to regenerate" }, { status: 500 });
  }
}
