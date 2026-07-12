// ─────────────────────────────────────────────────────────────────────────────
// Auth module — Firebase authentication for the Chrome extension
//
// Flow:
// 1. User clicks "Sign in" in popup/options
// 2. Extension opens the Isonomia login page in a new tab
// 3. After Firebase auth completes, the page calls our token-exchange endpoint
// 4. The endpoint returns a signed session token for the extension
// 5. Extension stores the token in chrome.storage.local
// 6. All API calls attach the token via Authorization header
// ─────────────────────────────────────────────────────────────────────────────

import type { StoredAuth } from "./types";
import { getApiBase } from "./api-client";

const AUTH_STORAGE_KEY = "isonomia_auth";

/** Get stored auth state from chrome.storage.local */
export async function getStoredAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const auth = result[AUTH_STORAGE_KEY] as StoredAuth | undefined;
  if (!auth) return null;

  // Check if token is expired (with 5-min buffer)
  if (auth.expiresAt < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAuthToken(auth.refreshToken);
    if (!refreshed) {
      await clearAuth();
      return null;
    }
    return refreshed;
  }

  return auth;
}

/** Get just the ID token (for API calls) */
export async function getAuthToken(): Promise<string | null> {
  const auth = await getStoredAuth();
  return auth?.idToken ?? null;
}

/** Check if user is currently logged in */
export async function isLoggedIn(): Promise<boolean> {
  const auth = await getStoredAuth();
  return auth !== null;
}

/** Store auth state after successful login */
export async function storeAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
  // Notify other extension components
  chrome.runtime.sendMessage({
    type: "AUTH_STATE_CHANGED",
    isLoggedIn: true,
  }).catch(() => {
    // Popup may not be open — ignore
  });
}

/** Clear auth state (logout) */
export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
  chrome.runtime.sendMessage({
    type: "AUTH_STATE_CHANGED",
    isLoggedIn: false,
  }).catch(() => {});
}

/**
 * Refresh an expired ID token using the refresh token.
 * Calls the Isonomia backend token-exchange endpoint.
 */
async function refreshAuthToken(
  refreshToken: string
): Promise<StoredAuth | null> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/auth/extension-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.ok) return null;

    const auth: StoredAuth = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
      user: data.user,
    };

    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
    return auth;
  } catch {
    return null;
  }
}

/**
 * Initiate login flow.
 * Opens the Isonomia login page with a redirect param that the page
 * uses to post the Firebase token back to the extension.
 */
export async function initiateLogin(): Promise<void> {
  const base = await getApiBase();
  const extensionId = chrome.runtime.id;
  const loginUrl = `${base}/login?ext=${extensionId}&redirect=extension`;
  await chrome.tabs.create({ url: loginUrl });
}

/** Get user info from stored auth */
export async function getUser(): Promise<StoredAuth["user"] | null> {
  const auth = await getStoredAuth();
  return auth?.user ?? null;
}
