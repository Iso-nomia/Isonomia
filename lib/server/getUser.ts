// lib/server/getUser.ts
'use server';
import 'server-only';

import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { toUser } from '../serverutils'; // make sure THIS file is also server-only
import { filterStandardClaims } from 'next-firebase-auth-edge/lib/auth/claims';
import { serverConfig } from '@/lib/firebase/config';
import { fetchUserByAuthId, createDefaultUser, clearUserCache } from '@/lib/actions/user.actions';

export async function getUserFromCookies() {
  clearUserCache();
  const cookieStore = cookies();
  // No session cookie ⇒ bearer/public request that bypassed authMiddleware.
  // Skip getTokens to avoid the "cookies were not verified by Middleware" warning.
  if (!cookieStore.get('__session')) return null;
  const tokens = await getTokens(cookieStore, serverConfig);
  if (!tokens) return null;

  // Your existing logic:
  const user = await toUser(tokens); // ensure toUser is server-only too
  return user;
}
