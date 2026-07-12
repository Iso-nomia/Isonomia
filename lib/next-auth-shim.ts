// Compatibility shim: provides next-auth session interface using Firebase auth
import { getUserFromCookies } from "@/lib/serverutils";

export type Session = { user: { id: string } } | null;

export async function getServerSession(_opts?: unknown): Promise<Session> {
  const user = await getUserFromCookies();
  if (!user?.userId) return null;
  return { user: { id: String(user.userId) } };
}
