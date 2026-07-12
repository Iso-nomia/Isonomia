import type { NextRequest } from 'next/server';

/**
 * Guard: _sheaf-acl-demo routes are dev-only.
 * Returns a 404 Response in production, or null if allowed.
 */
export function devOnlyGuard(): Response | null {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}

export async function readJSON<T>(req: NextRequest): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new Error('Invalid JSON');
  }
}

export function badRequest(message: string, extra?: any) {
  return new Response(JSON.stringify({ error: message, ...(extra ?? {}) }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

export function ok(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
