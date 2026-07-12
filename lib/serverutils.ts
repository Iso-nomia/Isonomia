
import { getTokens } from "next-firebase-auth-edge";
import { cookies, headers } from "next/headers";
import { User } from "./AuthContext";

import { Tokens } from "next-firebase-auth-edge";
import { filterStandardClaims } from "next-firebase-auth-edge/lib/auth/claims";
import {
  fetchUserByAuthId,
  createDefaultUser,
  clearUserCache,
} from "./actions/user.actions";
import { serverConfig } from "./firebase/config";
import { getAdminAuth } from "./firebase/admin";

export async function toUser({ decodedToken }: Tokens): Promise<User> {
  const {
    uid,
    email,
    picture: photoURL,
    email_verified: emailVerified,
    phone_number: phoneNumber,
    name: displayName,
    source_sign_in_provider: signInProvider,
  } = decodedToken;

  const customClaims = filterStandardClaims(decodedToken);
  let user = await fetchUserByAuthId(uid);
  if (!user) {
    user = await createDefaultUser({
      authId: uid,
      email,
      name: displayName,
      image: photoURL ?? null,
    });
  }
  const userId = user.id;
  const onboarded = user.onboarded;

  return {
    uid,
    email: email ?? null,
    displayName: displayName ?? null,
    photoURL: photoURL ?? user?.image ?? null,
    phoneNumber: phoneNumber ?? null,
    emailVerified: emailVerified ?? false,
    providerId: signInProvider,
    customClaims,
    userId,
    onboarded,
    bio: user?.bio ?? null,
    username: user?.username ?? null,
  };
}


export async function getUserFromCookies(): Promise<User | null> {
  clearUserCache();
  try {
    const cookieStore = cookies();
    // Skip cookie-based token extraction when there's no session cookie.
    // Bearer/public-API requests (extension, MCP, server-to-server) bypass
    // `authMiddleware`, so calling `getTokens` on them would emit the
    // "cookies were not verified by Middleware" warning before the caller
    // falls back to Bearer auth. No `__session` cookie ⇒ nothing to verify.
    if (!cookieStore.get("__session")) {
      return null;
    }
    const tokens = await getTokens(
      cookieStore,
      { ...serverConfig, debug: process.env.NODE_ENV !== "production" } // 👈 turn on debug in dev
    );
    if (!tokens) {
      console.warn("[auth] getTokens returned null");
      return null;
    }
    return toUser(tokens);
  } catch (e) {
    console.error("[auth] getTokens threw:", e);
    return null;
  }
}

export async function getCurrentUserId(): Promise<bigint | null> {
  // 1. Try cookie-based auth (standard web sessions)
  const u = await getUserFromCookies();
  if (u?.userId) return BigInt(u.userId);

  // 2. Fall back to Bearer token auth (Chrome extension, API clients)
  return getUserIdFromBearerToken();
}

export async function getCurrentUserAuthId(): Promise<string | null> {
  const u = await getUserFromCookies();
  if (u?.uid) return u.uid;

  // Fall back to Bearer token
  return getAuthIdFromBearerToken();
}

/**
 * Validate a Firebase ID token from the Authorization header.
 * Used by the Chrome extension which sends tokens via Bearer auth.
 */
async function getUserIdFromBearerToken(): Promise<bigint | null> {
  try {
    const hdrs = headers();
    const authHeader = hdrs.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const idToken = authHeader.slice(7);
    if (!idToken) return null;

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const user = await fetchUserByAuthId(decoded.uid);
    return user?.id ? BigInt(user.id) : null;
  } catch {
    return null;
  }
}

async function getAuthIdFromBearerToken(): Promise<string | null> {
  try {
    const hdrs = headers();
    const authHeader = hdrs.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const idToken = authHeader.slice(7);
    if (!idToken) return null;

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
