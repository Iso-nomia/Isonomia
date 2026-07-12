/**
 * API Middleware
 *
 * Authentication, authorization, and rate limiting middleware
 * for public API endpoints.
 *
 * @module lib/api/middleware
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./keys";
import { checkRateLimit, rateLimitHeaders, TIER_LIMITS } from "./rateLimit";
import { ApiKey, ApiKeyTier } from "@prisma/client";

export interface ApiAuthResult {
  authorized: boolean;
  user?: { id: bigint; username: string };
  apiKey?: ApiKey;
  error?: NextResponse;
}

/**
 * Standard API response headers
 */
function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Version": "1",
    ...extra,
  };
}

/**
 * Create an API error response
 */
export function apiError(
  code: string,
  message: string,
  status: number,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: apiHeaders(headers),
    }
  );
}

/**
 * Main API middleware
 *
 * Validates API key, checks scopes, and enforces rate limits.
 */
export async function apiMiddleware(
  req: NextRequest,
  requiredScopes: string[] = []
): Promise<ApiAuthResult> {
  // Extract API key from Authorization header
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return {
      authorized: false,
      error: apiError(
        "missing_authorization",
        "Authorization header required. Use: Authorization: Bearer <api_key>",
        401
      ),
    };
  }

  // Support both "Bearer <key>" and raw key
  const apiKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!apiKey) {
    return {
      authorized: false,
      error: apiError(
        "missing_api_key",
        "API key required",
        401
      ),
    };
  }

  // Validate the key
  const validation = await validateApiKey(apiKey);

  if (!validation.valid || !validation.apiKey) {
    return {
      authorized: false,
      error: apiError(
        "invalid_api_key",
        validation.error || "Invalid API key",
        401
      ),
    };
  }

  const keyData = validation.apiKey;

  // Check required scopes
  for (const scope of requiredScopes) {
    if (!keyData.scopes.includes(scope)) {
      return {
        authorized: false,
        error: apiError(
          "insufficient_scope",
          `This action requires the '${scope}' scope. Your key has: [${keyData.scopes.join(", ")}]`,
          403
        ),
      };
    }
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(
    keyData.id,
    keyData.tier,
    keyData.rateLimitOverride
  );

  if (!rateLimit.allowed) {
    const limits = TIER_LIMITS[keyData.tier as ApiKeyTier];
    return {
      authorized: false,
      error: apiError(
        "rate_limit_exceeded",
        `Rate limit exceeded. Limit: ${limits.requests} requests per hour.`,
        429,
        rateLimitHeaders(rateLimit)
      ),
    };
  }

  // Success - return authorized result with rate limit info
  return {
    authorized: true,
    user: keyData.user,
    apiKey: keyData,
  };
}

/**
 * Create a successful API response with rate limit headers
 */
export function apiSuccess<T>(
  data: T,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): NextResponse {
  const { status = 200, headers = {} } = options;

  return NextResponse.json(
    { data },
    {
      status,
      headers: apiHeaders(headers),
    }
  );
}

/**
 * Create a paginated API response
 */
export function apiPaginated<T>(
  data: T[],
  pagination: {
    hasMore: boolean;
    nextCursor?: string | null;
    total?: number;
  },
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    {
      data,
      pagination: {
        hasMore: pagination.hasMore,
        nextCursor: pagination.nextCursor || null,
        ...(pagination.total !== undefined && { total: pagination.total }),
      },
    },
    {
      status: 200,
      headers: apiHeaders(headers),
    }
  );
}

/**
 * Wrap an API handler with middleware
 */
export function withApiAuth(
  handler: (
    req: NextRequest,
    auth: { user: { id: bigint; username: string }; apiKey: ApiKey }
  ) => Promise<NextResponse>,
  requiredScopes: string[] = []
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await apiMiddleware(req, requiredScopes);

    if (!auth.authorized || !auth.user || !auth.apiKey) {
      return auth.error!;
    }

    try {
      return await handler(req, { user: auth.user, apiKey: auth.apiKey });
    } catch (error) {
      console.error("[API] Handler error:", error);
      return apiError(
        "internal_error",
        "An unexpected error occurred",
        500
      );
    }
  };
}

/**
 * Allowed origins for CORS.
 * In production, restrict to your domain(s).
 * Add additional origins as needed (e.g. preview deploy URLs).
 */
const ALLOWED_ORIGINS = new Set([
  "https://mesh.app",
  "https://www.mesh.app",
  // Vercel preview deploys
  ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
  // Local development
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
]);

function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow all Vercel preview deploys for your project
  if (origin.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * CORS headers for API responses.
 * Only reflects back origins that are explicitly allowed.
 */
export function corsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    ...(allowedOrigin ? { "Vary": "Origin" } : {}),
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight(req: NextRequest): NextResponse {
  const origin = req.headers.get("Origin") || undefined;
  if (!isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
