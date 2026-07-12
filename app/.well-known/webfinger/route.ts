import { NextRequest } from "next/server";
import { jrdResponse } from "@/lib/activitypub/base";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "";
  // Accept acct:alice@host or https URLs
  let handle = "";
  if (resource.startsWith("acct:")) {
    const at = resource.slice(5);
    const [user, host] = at.split("@");
    const reqHost = url.host;
    if (!user || !host || host.toLowerCase() !== reqHost.toLowerCase()) {
      return jrdResponse({ error: "mismatch host" }, { status: 404 });
    }
    handle = user;
  } else if (resource.startsWith("https://") || resource.startsWith("http://")) {
    try {
      const u = new URL(resource);
      const m = u.pathname.match(/^\/users\/([^/]+)$/);
      if (m) handle = decodeURIComponent(m[1]);
    } catch {}
  }
  if (!handle) return jrdResponse({ error: "bad resource" }, { status: 400 });

  const actor = `${url.origin}/users/${encodeURIComponent(handle)}`;
  const jrd = {
    subject: `acct:${handle}@${url.host}`,
    aliases: [actor],
    links: [
      { rel: "self", type: "application/activity+json", href: actor },
    ],
  };
  return jrdResponse(jrd);
}
