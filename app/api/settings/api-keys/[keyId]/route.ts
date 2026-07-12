export const dynamic = "force-dynamic";

/**
 * API Key Management - Single Key Operations
 *
 * Get, update, or revoke a specific API key.
 *
 * @route GET/PATCH/DELETE /api/settings/api-keys/[keyId]
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { revokeApiKey, updateApiKey, API_SCOPES } from "@/lib/api/keys";

interface RouteParams {
  params: Promise<{ keyId: string }>;
}

/**
 * GET - Get details of a specific API key
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyId } = await params;

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        tier: true,
        rateLimitOverride: true,
        lastUsedAt: true,
        requestCount: true,
        isActive: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    return NextResponse.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        tier: apiKey.tier,
        rateLimitOverride: apiKey.rateLimitOverride,
        lastUsedAt: apiKey.lastUsedAt,
        requestCount: apiKey.requestCount,
        isActive: apiKey.isActive,
        isRevoked: !!apiKey.revokedAt,
        revokedReason: apiKey.revokedReason,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      },
    });
  } catch (error) {
    console.error("[API Keys] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get API key" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update an API key (name, scopes, active status)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyId } = await params;

  try {
    const body = await req.json();
    const { name, scopes, isActive } = body;

    // Validate input
    const updates: { name?: string; scopes?: string[]; isActive?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.length < 1 || name.length > 100) {
        return NextResponse.json(
          { error: "Name must be 1-100 characters" },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (scopes !== undefined) {
      if (!Array.isArray(scopes)) {
        return NextResponse.json(
          { error: "Scopes must be an array" },
          { status: 400 }
        );
      }
      const validScopes = Object.keys(API_SCOPES);
      for (const scope of scopes) {
        if (!validScopes.includes(scope)) {
          return NextResponse.json(
            { error: `Invalid scope: ${scope}` },
            { status: 400 }
          );
        }
      }
      updates.scopes = scopes;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be a boolean" },
          { status: 400 }
        );
      }
      updates.isActive = isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const result = await updateApiKey(keyId, userId, updates);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: "API key updated successfully" });
  } catch (error) {
    console.error("[API Keys] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Revoke an API key
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyId } = await params;

  try {
    // Get optional reason from query params
    const { searchParams } = new URL(req.url);
    const reason = searchParams.get("reason") || undefined;

    const result = await revokeApiKey(keyId, userId, reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: "API key revoked successfully" });
  } catch (error) {
    console.error("[API Keys] Revoke error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
