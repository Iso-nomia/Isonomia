import { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { actorIdFromHandle, asJsonResponse, getOrigin } from "@/lib/activitypub/base";
import { getOrCreateApKey } from "@/lib/activitypub/keys";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
  const origin = getOrigin(req);
  const handle = params.handle;
  const user = await prisma.user.findFirst({
    where: { username: handle },
    select: { id: true, username: true, name: true, image: true },
  });
  if (!user) return asJsonResponse({ error: "not found" }, { status: 404 });

  // Ensure AP keypair exists
  const key = await getOrCreateApKey(user.id);

  const actorId = actorIdFromHandle(origin, handle);
  const doc = {
    "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
    id: actorId,
    type: "Person",
    preferredUsername: user.username,
    name: user.name,
    inbox: `${actorId}/inbox`,
    outbox: `${actorId}/outbox`,
    followers: `${actorId}/followers`,
    following: `${actorId}/following`,
    publicKey: {
      id: `${actorId}#main-key`,
      owner: actorId,
      publicKeyPem: key.public_pem,
    },
    icon: user.image
      ? { type: "Image", mediaType: "image/png", url: user.image }
      : undefined,
    url: `${origin}/profile/${user.id.toString()}`,
  };

  return asJsonResponse(doc);
}
