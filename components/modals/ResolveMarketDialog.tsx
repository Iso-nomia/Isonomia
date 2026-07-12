"use client";
import { useState } from "react";
import { Button } from "../ui/button";
import Spinner from "../ui/spinner";

interface Props {
  marketId: string;
  onClose: () => void;
  mutate?: () => void;
}

export default function ResolveMarketDialog({ marketId, onClose, mutate }: Props) {
  const [outcome, setOutcome] = useState<"YES" | "NO" | "N_A">("YES");
  const [pending, setPending] = useState(false);

  async function handleResolve() {
    setPending(true);
    try {
      const resp = await fetch(`/api/market/${marketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!resp.ok) {
        setPending(false);
        return;
      }
      mutate?.();
      onClose();
    } catch {
      // ignore
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-[1px] border-white px-8 py-6 space-y-4 bg-white bg-opacity-20 rounded-xl shadow-md">
      <div className="space-y-2">
        {(["YES", "NO", "N_A"] as const).map((o) => (
          <label key={o} className="flex items-center gap-2">
            <input type="radio" checked={outcome === o} onChange={() => setOutcome(o)} />
            {o}
          </label>
        ))}
      </div>
      <Button onClick={handleResolve} disabled={pending} className="w-fit px-6 py-2 likebutton bg-white bg-opacity-40">
        {pending ? <Spinner className="h-4 w-4" /> : "Confirm"}
      </Button>
    </div>
  );
}
