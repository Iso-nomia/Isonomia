import type { NextApiRequest } from 'next';
import { getApiRequestTokens } from 'next-firebase-auth-edge/lib/next/tokens';
// import { authConfig } from './authConfig';

export async function getUserFromReq(req: NextApiRequest) {
  // next-firebase-auth-edge requires an options object (apiKey + cookie config).
  // Supply the project auth config here; cast keeps the legacy Pages-router
  // helper compiling until a real config is wired in.
  const tokens = await getApiRequestTokens(
    req,
    {
      apiKey: process.env.FIREBASE_API_KEY ?? "",
      cookieName: process.env.AUTH_COOKIE_NAME ?? "AuthToken",
      cookieSignatureKeys: (process.env.AUTH_COOKIE_SIGNATURE_KEYS ?? "").split(",").filter(Boolean),
    } as any
    /*, authConfig */
  );

  if (!tokens) return null;

  const { decodedToken } = tokens;
  return {
    userId: decodedToken.uid,
    email: decodedToken.email ?? null,
  };
}
