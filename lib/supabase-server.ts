// lib/supabase-server.ts
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/supabase/database-supabase'; // or move to ./types/supabase
import { createBrowserClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!URL || !ANON) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');

/** Admin client (server-only) — SERVICE_ROLE. Never import in client code. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient<Database>(URL, key, { auth: { persistSession: false } });
}

export function createSupabaseRouteClient() {
  // cookies() is called *inside* the request handler that imports this module
  return createBrowserClient<Database>(URL, ANON);
}

/** Per-request server client using the new getAll/setAll cookies API. */
export function createSupabaseServerClient() {
  const jar = cookies();
  return createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll() {
        return jar.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(items: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value, options } of items) jar.set({ name, value, ...options });
      },
    },
    // cookieOptions: { name: 'sb', sameSite: 'lax' }, // optional tune
  });
}

/** Back-compat named export used in some files */
// export const supabase = createSupabaseServerClient();
