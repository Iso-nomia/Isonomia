// Compatibility shim: redirects @/util/supabase/server → @/lib/supabase-server
// Provides `createClient` that API routes expect for per-request server supabase clients
export { createSupabaseServerClient as createClient } from "@/lib/supabase-server";
