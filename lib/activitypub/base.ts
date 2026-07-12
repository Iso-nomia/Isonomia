// lib/activitypub/base.ts
import type { NextRequest } from "next/server";

export function getOrigin(req: NextRequest): string {
  // Prefer explicit env in prod; fall back to headers in dev
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (env) return env;

  const url = new URL(req.url);
  const proto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).toLowerCase();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function actorIdFromHandle(origin: string, handle: string) {
  return `${origin}/users/${encodeURIComponent(handle)}`;
}

export function asJsonResponse(data: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/activity+json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function jrdResponse(data: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/jrd+json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}
