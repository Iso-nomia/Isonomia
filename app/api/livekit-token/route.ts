export const dynamic = "force-dynamic";

import { AccessToken } from "livekit-server-sdk";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room");
  const name = url.searchParams.get("name");
  if (!room || !name) return new Response("Missing params", { status: 400 });
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: name },
  );
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  return Response.json({ token });
}
