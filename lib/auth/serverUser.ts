import 'server-only';
import { getUserFromCookies } from '@/lib/server/getUser';

/**
 * Preferred: async user id via Firebase cookies.
 * If an x-user-id header is present, we honor it (useful for service calls).
 */
export async function getUserIdFromRequest(req: Request): Promise<string> {
  // Header override (useful in tests and internal calls)
  const hdr = req.headers.get('x-user-id');
  if (hdr && hdr.trim().length > 0) return hdr.trim();

  try {
    const u = await getUserFromCookies(); // your provided helper
    if (u?.userId != null) return String(u.userId);
  } catch (e) {
    // swallow and fallback
    console.warn('[auth] getUserFromCookies failed in getUserIdFromRequest:', e);
  }
  return 'system';
}

/** Synchronous fallback (for logging etc.). Avoid for writes; prefer the async version. */
export function getUserIdFromRequestSync(req: Request): string {
  const hdr = req.headers.get('x-user-id');
  return (hdr && hdr.trim().length > 0) ? hdr.trim() : 'system';
}
