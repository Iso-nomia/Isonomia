import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { event, coords } = await req.json();
  const user = await getUserFromCookies().catch(() => null);

  setImmediate(async () => {
    try {
      await prisma.telemetry.create({
        data: {
          event,
          coords,
          userId: user?.userId ? BigInt(user.userId) : null,
        },
      });
    } catch (err) {
      console.error(err);
    }
  });

  return new Response("ok");
}
