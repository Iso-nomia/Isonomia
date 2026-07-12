// lib/activitypub/keys.ts
import { prisma } from "@/lib/prismaclient";
import { generateKeyPairSync } from "crypto";

export async function getOrCreateApKey(userId: bigint) {
  let row = await prisma.activityPubKey.findUnique({ where: { user_id: userId } }).catch(() => null);
  if (row) return row;

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  row = await prisma.activityPubKey.create({
    data: { user_id: userId, public_pem: publicKey, private_pem: privateKey },
  });
  return row;
}
