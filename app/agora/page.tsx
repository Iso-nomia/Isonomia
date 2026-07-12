// app/agora/page.tsx
import Agora from "./ui/Agora";
export const dynamic = "force-dynamic";

export default async function AgoraPage() {
  const res = await fetch("/api/agora/events?limit=30", { cache: "no-store" }).catch(() => null);
  const j = await res?.json().catch(() => null);
  // Use items; keep a short fallback to avoid a blank feed during migration
  const initial = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.events) ? j.events : []);
  return <Agora initialEvents={initial} />;
}