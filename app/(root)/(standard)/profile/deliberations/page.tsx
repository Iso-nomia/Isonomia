import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { redirect } from "next/navigation";
import DelibsDashboard from "./ui/DelibsDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await getUserFromCookies();
  if (!u) redirect("/login");
  const ownerId = String(u.userId);

  // first page
  const rows = await prisma.deliberation.findMany({
    where: { createdById: ownerId },
    orderBy: [{ createdAt: "desc" }],
    take: 15,
    select: { id: true, hostType: true, hostId: true, createdAt: true },
  });

  const initialItems = rows.map(r => ({
    id: r.id,
    hostType: String(r.hostType),
    hostId: r.hostId,
    createdAt: r.createdAt.toISOString(),
    title: null,
    tags: [],
  }));

  return <DelibsDashboard initialItems={initialItems} />;
}
