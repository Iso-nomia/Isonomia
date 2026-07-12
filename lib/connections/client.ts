// lib/connections/client.ts
// Client-safe wrappers. These talk to /api/connections so UI never imports server-only code.

export type Connection = {
    provider: string;
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: string | null | Date; // server returns Date; we normalize to string in JSON
    scopes: string[];
    accountLabel?: string | null;
    metadata?: Record<string, any> | null;
  };
  
  export class MissingScopesError extends Error {
    missingScopes: string[];
    constructor(message: string, missingScopes: string[]) {
      super(message);
      this.name = "MissingScopesError";
      this.missingScopes = missingScopes;
    }
  }
  
  /**
   * Fetch a connection; optionally assert required scopes.
   * Note: userId is optional if your API route can infer current user — here we pass it explicitly.
   */
  export async function getConnectionClient(args: {
    userId: string | number | bigint;
    provider: string;
    requiredScopes?: string[];
  }): Promise<Connection> {
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: typeof args.userId === "bigint" ? String(args.userId) : args.userId,
        provider: args.provider,
        requiredScopes: args.requiredScopes,
      }),
      cache: "no-store",
    });
  
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 403 && Array.isArray(json?.missingScopes)) {
        throw new MissingScopesError(json?.error || "Missing scopes", json.missingScopes);
      }
      throw new Error(json?.error || `getConnection failed (${res.status})`);
    }
  
    const c = json.connection as Connection;
    // Normalize expiresAt to Date (optional)
    if (c && typeof c.expiresAt === "string") c.expiresAt = new Date(c.expiresAt);
    return c;
  }
  
  /**
   * Persist refreshed tokens (or initial connect payload).
   * Send only what changed; server handles encryption and upsert.
   */
  export async function upsertConnectionTokensClient(args: {
    userId: string | number | bigint;
    provider: string;
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: Date | string | null;
    scopes?: string[];
    externalAccountId?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    const res = await fetch("/api/connections", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...args,
        userId: typeof args.userId === "bigint" ? String(args.userId) : args.userId,
        expiresAt: args.expiresAt instanceof Date ? args.expiresAt.toISOString() : args.expiresAt ?? null,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || `upsertConnectionTokens failed (${res.status})`);
    }
  }

  // export class MissingScopesError extends Error {
  //   code = "MISSING_SCOPES" as const;
  //   missingScopes: string[];
  //   provider: string;
  //   constructor(provider: string, missingScopes: string[]) {
  //     super(`Missing scopes for ${provider}: ${missingScopes.join(", ")}`);
  //     this.name = "MissingScopesError";
  //     this.provider = provider;
  //     this.missingScopes = missingScopes;
  //   }
  // }
  
  /** Returns true if all required scopes are present (case-insensitive). */
  export function hasScopes(conn: Connection, required: string[]): boolean {
    const have = new Set((conn.scopes ?? []).map(s => s.toLowerCase()));
    return required.every(s => have.has(s.toLowerCase()));
  }
  
  /** Throws MissingScopesError if any required scopes are missing. */
  export function requireScopesClient(conn: Connection, required: string[]): void {
    const have = new Set((conn.scopes ?? []).map(s => s.toLowerCase()));
    const missing = required.filter(s => !have.has(s.toLowerCase()));
    if (missing.length) {
      throw new MissingScopesError(conn.provider, missing);
    }
  }