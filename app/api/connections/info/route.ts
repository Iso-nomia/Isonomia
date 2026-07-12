// app/api/connections/route.ts
import { NextResponse } from "next/server";


import {
  getConnection,
  upsertConnectionTokens,
  requireScopes,
} from '@/lib/connections/service'

export const dynamic = "force-dynamic"; // no caching

function bad(status: number, message: string, extra?: any) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId: string | number | bigint;
      provider: string;
      requiredScopes?: string[];
    };

    if (!body?.provider) return bad(400, "provider is required");
    if (body?.userId === undefined || body?.userId === null) return bad(400, "userId is required");

    const userIdBig = typeof body.userId === "bigint" ? body.userId : BigInt(body.userId as any);

    const conn = await getConnection(userIdBig, body.provider);

    // Optional scope gate right here if requested by caller
    if (Array.isArray(body.requiredScopes) && body.requiredScopes.length) {
      try {
        requireScopes(conn, body.requiredScopes);
      } catch (e: any) {
        return bad(403, e?.message ?? "Missing scopes", { missingScopes: e?.missingScopes ?? body.requiredScopes });
      }
    }

    return NextResponse.json({ ok: true, connection: conn }, { headers: { "cache-control": "no-store" } });
  } catch (err: any) {
    // Intentionally do not leak token values
    return bad(500, err?.message ?? "Failed to fetch connection");
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      userId: string | number | bigint;
      provider: string;
      accessToken?: string;
      refreshToken?: string | null;
      expiresAt?: string | null;   // ISO string allowed
      scopes?: string[];
      externalAccountId?: string | null;
      metadata?: Record<string, any> | null;
    };

    if (!body?.provider) return bad(400, "provider is required");
    if (body?.userId === undefined || body?.userId === null) return bad(400, "userId is required");

    const userIdBig = typeof body.userId === "bigint" ? body.userId : BigInt(body.userId as any);

    await upsertConnectionTokens({
      userId: userIdBig,
      provider: body.provider,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      scopes: body.scopes,
      externalAccountId: body.externalAccountId ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (err: any) {
    return bad(500, err?.message ?? "Failed to upsert connection tokens");
  }
}
