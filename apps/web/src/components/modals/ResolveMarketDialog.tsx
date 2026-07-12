"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { toast } from "sonner";

interface Props {
  marketId: string;
  onResolved: () => void;
}

export default function ResolveMarketDialog({ marketId, onResolved }: Props) {
  const [outcome, setOutcome] = useState<"YES" | "NO" | null>(null);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (!outcome) return;
    setPending(true);
    try {
      const resp = await fetch(`/api/market/${marketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (resp.ok) {
        onResolved();
      } else {
        toast.error("Resolution failed");
      }
    } catch {
      toast.error("Resolution failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-[1px] border-white px-8 py-6 space-y-4 bg-white bg-opacity-20 rounded-xl shadow-md">
      <div className="space-y-2">
        {(["YES", "NO"] as const).map((o) => (
          <label key={o} className="flex items-center gap-2">
            <input type="radio" checked={outcome === o} onChange={() => setOutcome(o)} />
            {o}
          </label>
        ))}
      </div>
      <Button onClick={handleConfirm} disabled={pending || !outcome} className="w-fit px-6 py-2 likebutton bg-white bg-opacity-40">
        {pending ? <Spinner className="h-4 w-4" /> : "Confirm"}
      </Button>
    </div>
  );
}
