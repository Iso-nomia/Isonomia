export const dynamic = "force-dynamic";

/**
 * API Key Management Endpoint
 *
 * Allows users to create, list, and revoke their API keys.
 *
 * @route GET/POST /api/settings/api-keys
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  generateApiKey,
  listApiKeys,
  API_SCOPES,
  ApiScope,
} from "@/lib/api/keys";

/**
 * GET - List all API keys for the current user
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(userId);

    // Transform for client display
    const data = keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      tier: key.tier,
      lastUsedAt: key.lastUsedAt,
      requestCount: key.requestCount,
      isActive: key.isActive,
      isRevoked: !!key.revokedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));

    return NextResponse.json({
      data,
      availableScopes: API_SCOPES,
    });
  } catch (error) {
    console.error("[API Keys] List error:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new API key
 */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate input
    const { name, scopes, expiresInDays } = body;

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { error: "Name is required (1-100 characters)" },
        { status: 400 }
      );
    }

    // Validate scopes
    const validScopes = Object.keys(API_SCOPES);
    const requestedScopes = scopes || ["read:sources", "read:stacks"];

    if (!Array.isArray(requestedScopes)) {
      return NextResponse.json(
        { error: "Scopes must be an array" },
        { status: 400 }
      );
    }

    for (const scope of requestedScopes) {
      if (!validScopes.includes(scope)) {
        return NextResponse.json(
          { error: `Invalid scope: ${scope}. Valid scopes: ${validScopes.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Calculate expiration
    let expiresAt: Date | undefined;
    if (expiresInDays && typeof expiresInDays === "number" && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Generate the key
    const result = await generateApiKey(userId, name, {
      scopes: requestedScopes as ApiScope[],
      expiresAt,
    });

    // Return the full key (only time it's shown)
    return NextResponse.json({
      message: "API key created successfully. Save this key - it won't be shown again.",
      key: result.key,
      id: result.keyId,
      keyPrefix: result.keyPrefix,
    });
  } catch (error) {
    console.error("[API Keys] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
