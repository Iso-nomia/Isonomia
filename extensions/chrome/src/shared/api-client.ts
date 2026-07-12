// ─────────────────────────────────────────────────────────────────────────────
// Authenticated API client for the Isonomia Chrome extension
//
// All calls attach the Firebase ID token via Authorization header.
// The server-side token-exchange endpoint validates the token and creates
// a session, so existing getCurrentUserId() works transparently.
// ─────────────────────────────────────────────────────────────────────────────

import { getAuthToken } from "./auth";
import type {
  QuickArgumentRequest,
  QuickArgumentResponse,
  UnfurlResponse,
  ArgumentMeta,
  ClaimMeta,
  VerifyResolveResponse,
  VerifyBackingResponse,
} from "./types";

const API_BASE_KEY = "isonomia_api_base";
const DEFAULT_API_BASE = "https://isonomia.app";

/** Get the configured API base URL */
export async function getApiBase(): Promise<string> {
  const result = await chrome.storage.local.get(API_BASE_KEY);
  return (result[API_BASE_KEY] as string) || DEFAULT_API_BASE;
}

/** Set the API base URL (for dev/staging) */
export async function setApiBase(url: string): Promise<void> {
  await chrome.storage.local.set({ [API_BASE_KEY]: url });
}

/**
 * Fetch with authentication.
 * Attaches the Firebase ID token as a Bearer token in the Authorization header.
 * The server-side middleware validates this and creates a session.
 */
async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = await getApiBase();
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const url = `${base}${path}`;
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    throw new Error("Session expired — please sign in again");
  }

  return res;
}

/** Parse JSON response with error handling */
async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // Body not JSON — use status text
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// API methods
// ─────────────────────────────────────────────────────────────────────────────

export const IsonomiaAPI = {
  /**
   * Create a quick argument (claim + evidence + argument + permalink)
   * POST /api/arguments/quick
   */
  async createQuickArgument(
    data: QuickArgumentRequest
  ): Promise<QuickArgumentResponse> {
    const res = await fetchWithAuth("/api/arguments/quick", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return parseResponse<QuickArgumentResponse>(res);
  },

  /**
   * Unfurl a URL to extract OG metadata
   * GET /api/unfurl?url={encodedUrl}
   */
  async unfurlUrl(url: string): Promise<UnfurlResponse> {
    const encoded = encodeURIComponent(url);
    const res = await fetchWithAuth(`/api/unfurl?url=${encoded}`);
    return parseResponse<UnfurlResponse>(res);
  },

  /**
   * Get argument metadata by identifier (shortCode or slug)
   * GET /api/a/{identifier} with Accept: application/json
   */
  async getArgumentMeta(identifier: string): Promise<ArgumentMeta> {
    const base = await getApiBase();
    // This endpoint is public — no auth needed
    const res = await fetch(`${base}/api/a/${identifier}`, {
      headers: { Accept: "application/json" },
    });
    return parseResponse<ArgumentMeta>(res);
  },

  /**
   * Get claim metadata by moid
   * GET /api/c/{moid} with Accept: application/json
   */
  async getClaimMeta(moid: string): Promise<ClaimMeta> {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/c/${moid}`, {
      headers: { Accept: "application/json" },
    });
    return parseResponse<ClaimMeta>(res);
  },

  /**
   * verify-mode-B v0 — resolve a page's outbound links and cluster by identity
   * root ("N tellings → M roots"). URLs only; no page content leaves the browser.
   * POST /api/verify/resolve
   */
  async verifyLinks(urls: string[]): Promise<VerifyResolveResponse> {
    const res = await fetchWithAuth("/api/verify/resolve", {
      method: "POST",
      body: JSON.stringify({ urls }),
    });
    return parseResponse<VerifyResolveResponse>(res);
  },

  /**
   * verify-mode-B v1b — check whether each cited source backs its claim (C4).
   * Sends ONLY the on-device-extracted {claim, citedUrl} pairs — never page body.
   * POST /api/verify/backing
   */
  async checkBacking(pairs: { claim: string; citedUrl: string }[]): Promise<VerifyBackingResponse> {
    const res = await fetchWithAuth("/api/verify/backing", {
      method: "POST",
      body: JSON.stringify({ pairs }),
    });
    return parseResponse<VerifyBackingResponse>(res);
  },

  /**
   * Search arguments by query text
   * GET /api/arguments/search?q={query}
   */
  async searchArguments(
    query: string
  ): Promise<{ ok: boolean; results: ArgumentMeta[] }> {
    const encoded = encodeURIComponent(query);
    const res = await fetchWithAuth(`/api/arguments/search?q=${encoded}`);
    return parseResponse<{ ok: boolean; results: ArgumentMeta[] }>(res);
  },

  /**
   * Get the current user's recent arguments
   * GET /api/arguments/recent?limit={n}
   */
  async getRecentArguments(
    limit = 5
  ): Promise<{ ok: boolean; arguments: ArgumentMeta[] }> {
    const res = await fetchWithAuth(`/api/arguments/recent?limit=${limit}`);
    return parseResponse<{ ok: boolean; arguments: ArgumentMeta[] }>(res);
  },
};
