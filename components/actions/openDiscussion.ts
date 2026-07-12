// components/actions/openDiscussion.ts
"use client";
import { useRouter } from "next/navigation";
export function useOpenDiscussion() {
  const router = useRouter();
  return async (hostType: string, hostId: string) => {
    const r = await fetch("/api/deliberations/spawn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostType, hostId }) });
    const j = await r.json();
    if (r.ok && j.deliberationId) router.push(`/deliberation/${j.deliberationId}`);
    else alert(j.error || "Failed to open discussion");
  };
}
