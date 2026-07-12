// lib/auth/server.ts
import { cookies } from 'next/headers';
import { getTokens, Tokens } from 'next-firebase-auth-edge';
import { filterStandardClaims } from 'next-firebase-auth-edge/lib/auth/claims';
import { serverConfig } from '@/lib/firebase/config';               // your existing config
import type { User } from './types';
import {
  fetchUserByAuthId,
  createDefaultUser,
  clearUserCache,
} from '@/lib/actions/user.actions';                     // server action is fine to import

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

  return {
    uid,
    email: email ?? null,
    displayName: displayName ?? null,
    photoURL: photoURL ?? user?.image ?? null,
    phoneNumber: phoneNumber ?? null,
    emailVerified: emailVerified ?? false,
    providerId: signInProvider,
    customClaims,
    userId: user.id,         // keep as-is; you can BigInt it elsewhere if needed
    onboarded: user.onboarded,
    bio: user?.bio ?? null,
    username: user?.username ?? null,
  };
}

export async function getUserFromCookies(): Promise<User | null> {
  clearUserCache(); // your cache invalidation
  try {
    const cookieStore = cookies();
    // No session cookie ⇒ bearer/public request that bypassed authMiddleware.
    // Skip getTokens to avoid the "cookies were not verified by Middleware" warning.
    if (!cookieStore.get('__session')) {
      return null;
    }
    const tokens = await getTokens(
      cookieStore,
      { ...serverConfig, debug: process.env.NODE_ENV !== 'production' }
    );
    if (!tokens) {
      console.warn('[auth] getTokens returned null');
      return null;
    }
    return toUser(tokens);
  } catch (e) {
    console.error('[auth] getTokens threw:', e);
    return null;
  }
}

// Optional helper if you still need a BigInt in some Prisma writes:
export async function getCurrentUserIdAsBigInt(): Promise<bigint | null> {
  const u = await getUserFromCookies();
  if (!u?.userId) return null;
  try {
    // If userId is already a bigint, this will still work
    return BigInt(u.userId as any);
  } catch {
    return null;
  }
}
