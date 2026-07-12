import { prisma } from "./prismaclient";

export async function canonicalise(title: string): Promise<string | null> {
  const base = title.replace(/\s*\([^)]*\)/, "").trim();
  const media = await prisma.canonicalMedia.findFirst({
    where: {
      title: { equals: base, mode: "insensitive" },
    },
    select: { id: true },
  });
  return media?.id || null;
}
