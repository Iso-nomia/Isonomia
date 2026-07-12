/**
 * API Key Management
 *
 * Functions for generating, validating, and revoking API keys
 * for the public evidence API.
 *
 * @module lib/api/keys
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import { ApiKey, ApiKeyTier } from "@prisma/client";

const KEY_PREFIX = "mesh_pk_";

export interface GeneratedApiKey {
  key: string;       // Full key (only returned once)
  keyId: string;     // Database ID
  keyPrefix: string; // Prefix for display
}

export interface ApiKeyValidation {
  valid: boolean;
  apiKey?: ApiKey & { user: { id: bigint; username: string } };
  error?: string;
}

/**
 * Generate a new API key for a user
 */
export async function generateApiKey(
  userId: bigint,
  name: string,
  options: {
    scopes?: string[];
    tier?: ApiKeyTier;
    expiresAt?: Date;
  } = {}
): Promise<GeneratedApiKey> {
  const {
    scopes = ["read:sources", "read:stacks"],
    tier = "free",
    expiresAt,
  } = options;

  // Generate a secure random key
  const randomPart = crypto.randomBytes(32).toString("base64url");
  const fullKey = `${KEY_PREFIX}${randomPart}`;

  // Hash for storage (never store the raw key)
  const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

  // Create in database
  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      keyPrefix: fullKey.slice(0, 16), // Store more chars for easier identification
      scopes,
      tier,
      expiresAt,
    },
  });

  // Return the full key only once (user must save it)
  return {
    key: fullKey,
    keyId: apiKey.id,
    keyPrefix: apiKey.keyPrefix,
  };
}

/**
 * Validate an API key and return associated data
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidation> {
  // Check prefix format
  if (!key.startsWith(KEY_PREFIX)) {
    return { valid: false, error: "Invalid key format" };
  }

  // Hash the provided key
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  // Look up by hash
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
  });

  if (!apiKey) {
    return { valid: false, error: "Key not found" };
  }

  // Check if active
  if (!apiKey.isActive) {
    return { valid: false, error: "Key is inactive" };
  }

  // Check if revoked
  if (apiKey.revokedAt) {
    return { valid: false, error: "Key has been revoked" };
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: "Key has expired" };
  }

  // Update usage stats (fire and forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        requestCount: { increment: 1 },
      },
    })
    .catch(() => {
      // Log but don't fail the request
    });

  return { valid: true, apiKey };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  keyId: string,
  userId: bigint,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!apiKey) {
    return { success: false, error: "Key not found" };
  }

  // Verify ownership
  if (apiKey.userId !== userId) {
    return { success: false, error: "Not authorized to revoke this key" };
  }

  // Already revoked?
  if (apiKey.revokedAt) {
    return { success: false, error: "Key already revoked" };
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      revokedAt: new Date(),
      revokedReason: reason || "Revoked by user",
      isActive: false,
    },
  });

  return { success: true };
}

/**
 * List API keys for a user (without revealing the actual keys)
 */
export async function listApiKeys(userId: bigint): Promise<
  Array<{
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    tier: ApiKeyTier;
    lastUsedAt: Date | null;
    requestCount: number;
    isActive: boolean;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }>
> {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      tier: true,
      lastUsedAt: true,
      requestCount: true,
      isActive: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return keys;
}

/**
 * Update API key settings (name, scopes, tier)
 */
export async function updateApiKey(
  keyId: string,
  userId: bigint,
  updates: {
    name?: string;
    scopes?: string[];
    isActive?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!apiKey) {
    return { success: false, error: "Key not found" };
  }

  if (apiKey.userId !== userId) {
    return { success: false, error: "Not authorized" };
  }

  if (apiKey.revokedAt) {
    return { success: false, error: "Cannot update a revoked key" };
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: updates,
  });

  return { success: true };
}

/**
 * Available API scopes
 */
export const API_SCOPES = {
  "read:sources": "Read source data",
  "read:stacks": "Read public stacks",
  "read:citations": "Read citations/evidence",
  "write:sources": "Create and update sources",
  "write:stacks": "Create and update stacks",
} as const;

export type ApiScope = keyof typeof API_SCOPES;

/**
 * Check if a key has a specific scope
 */
export function hasScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes(requiredScope);
}

/**
 * Check if a key has all required scopes
 */
export function hasAllScopes(scopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every((scope) => scopes.includes(scope));
}
