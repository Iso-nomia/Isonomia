// components/claims/ConfirmEpistemicButton.tsx
"use client";
import useSWR from "swr";
export default function ConfirmEpistemicButton({ claimId }: { claimId: string }) {
  const { data } = useSWR(`/api/claims/${claimId}/threshold`, (u) => fetch(u).then((r) => r.json()));
  if (!data?.ok) return null;

  async function confirm() {
    const r = await fetch("/api/dialogue/panel/confirm", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimId, inputs: { citations: true, cq: true, af: true } }) });
    if (!r.ok) alert("Confirm failed");
  }

  return (
    <button onClick={confirm} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white" title="CQ ≥80% + ≥2 sources">Confirm (epistemic)</button>
  );
}
