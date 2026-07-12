// lib/activitypub/deliver.ts
import { httpSign, makeDigest } from "./signing";

export async function deliverActivity({
  toInbox,
  activity,
  keyId,
  privateKeyPem,
}: {
  toInbox: string;
  activity: any;
  keyId: string;
  privateKeyPem: string;
}) {
  const body = JSON.stringify(activity);
  const url = new URL(toInbox);
  const headers: Record<string, string> = {
    date: new Date().toUTCString(),
    host: url.host,
    "content-type": "application/activity+json",
    digest: makeDigest(body),
  };
  httpSign({ url, method: "POST", headers, body, keyId, privateKeyPem });
  const r = await fetch(url.toString(), { method: "POST", headers, body });
  return r;
}
