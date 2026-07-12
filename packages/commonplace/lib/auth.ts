import { prisma } from "./prisma";
import { createClient } from "./supabase/server";

/**
 * Returns the current Supabase user joined with the local Author row,
 * provisioning the Author on first sight. Returns null if not signed in.
 */
export async function getCurrentAuthor() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const author = await prisma.author.upsert({
    where: { email: user.email },
    update: {},
    create: {
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
    },
  });

  return { user, author };
}

/**
 * Throws (via Next's notFound/redirect) if not signed in.
 * Use in API routes — return a 401 manually.
 */
export async function requireAuthor() {
  const ctx = await getCurrentAuthor();
  if (!ctx) {
    throw new Error("UNAUTHENTICATED");
  }
  return ctx;
}
