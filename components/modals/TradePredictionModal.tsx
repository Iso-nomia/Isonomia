"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
// import { priceYes } from "@/lib/prediction/lmsr";
import { priceYes, costToBuy } from "@/lib/prediction/lmsr";
import { estimateShares } from "@/lib/prediction/tradePreview";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import Spinner from "../ui/spinner";
import { Alert } from "../ui/alert";
import { toast } from "sonner";
import { Market } from "@/lib/types/prediction";


interface Props {
  market: Market;
  onClose: () => void;
  mutateMarket?: (updater?: any) => void;
}

export default function TradePredictionModal({
  market,
  onClose,
  mutateMarket,
}: Props) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [spend, setSpend] = useState<number>(10);
  const [maxSpend, setMaxSpend] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- helpers (declare *before* they are used) ---------- */
  const safeNum = (n: number | undefined | null) =>
    Number.isFinite(n) ? n! : 0;
  const safeB = (n: number | undefined | null) =>
    Number.isFinite(n) && n! > 0 ? n! : 100;

  // Use safeB so b is never 0 and priceYes never returns NaN
  const currentPrice = useMemo(
    () =>
      priceYes(
        safeNum(market.yesPool),
        safeNum(market.noPool),
        safeB(market.b)
      ),
    [market]
  );

  useEffect(() => {
    fetch("/api/wallet")
      .then(async (r) => {
        if (!r.ok) throw r;
        const d = await r.json();
        setMaxSpend(Number(d.balanceCents));
      })
      .catch((e) => {
        console.error("wallet fetch failed", e);
        setMaxSpend(0);
      });
  }, []);

  // const safeNum = (n: number | undefined | null) =>
  // Number.isFinite(n) ? n! : 0;
  // const safeB   = (n: number | undefined | null) =>
  // Number.isFinite(n) && n! > 0 ? n! : 100;

  //   const { shares, cost } = useMemo(() => {
  //     // if (!spend) return { shares: 0, cost: 0 };
  //     if (!Number.isFinite(spend) || spend <= 0)
  //   return { shares: 0, cost: 0 };
  //     try {
  //       return estimateShares(
  //         side,
  //          safeNum(spend),
  //  safeNum(market.yesPool),
  //  safeNum(market.noPool),
  //  safeNum(market.b)
  //       );
  //     } catch (e) {
  //       setError("Invalid spend amount");
  //       return { shares: 0, cost: 0 };
  //     }
  //   }, [spend, side, market]);
  // const { shares } = useMemo(() => {
  //     if (!Number.isFinite(spend) || spend <= 0) return { shares: 0 };
  //     try {
  //       return estimateShares(side, spend, safeNum(market.yesPool),
  //                             safeNum(market.noPool), safeB(market.b));
  //     } catch {
  //       return { shares: 0 };
  //     }
  //   }, [spend, side, market]);
  //   const cost = spend;
  //   useEffect(() => {
  //     // ⚠ remove after debugging
  //     console.log({ spend, cost, shares, market });
  //   }, [spend, cost, shares, market]);

  //   const priceAfter = useMemo(() => {
  //     const yes = market.yesPool + (side === "YES" ? shares : 0);
  //     const no = market.noPool + (side === "NO" ? shares : 0);
  //     return priceYes(yes, no, market.b);
  //   }, [shares, side, market]);
  /** ---------------  LIVE PREVIEW --------------- **/
  const cost = spend; // 👈 credits the user intends to spend

  const shares = useMemo(() => {
    if (!Number.isFinite(spend) || spend <= 0) return 0;
    try {
      return estimateShares(
        side,
        safeNum(spend),
        safeNum(market.yesPool),
        safeNum(market.noPool),
        safeB(market.b)
      ).shares;
    } catch {
      return 0;
    }
  }, [spend, side, market]);

  const priceAfter = useMemo(() => {
    if (shares === 0) return currentPrice;
    const yes = safeNum(market.yesPool) + (side === "YES" ? shares : 0);
    const no = safeNum(market.noPool) + (side === "NO" ? shares : 0);
    const p = priceYes(yes, no, safeB(market.b));
    return Number.isFinite(p) ? p : currentPrice;
  }, [shares, side, market]);

  const handleTrade = useCallback(async () => {
    // setPending(true);
    // setError(null);
    // if (!Number.isFinite(cost) || cost <= 0) {
    //console.log("posting trade", { side, spendCents: Math.ceil(spend) });
    console.log({ pending, spend, maxSpend });
    console.log("posting trade", {
      side,
      spendCents: Math.ceil(spend),
      id: market.id,
    });

    if (!Number.isFinite(spend) || spend <= 0) {
      setError("Choose a valid amount");
      return;
    }
    // if (!Number.isFinite(priceAfter)) {
    //     setError("Preview invalid, try smaller spend");
    //     return;
    //   }
    if (!market?.id) {
      toast.error("Market unavailable, try again in a second");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const resp = await fetch(`/api/market/${market.id}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({ side, spendCents: Math.ceil(cost) }),
        body: JSON.stringify({ side, spendCents: Math.ceil(spend) }),
      });
      if (resp.status !== 200) {
        const data = await resp.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Trade failed");
        return;
      }
      const result = await resp.json();
      const tradedShares = result.shares ?? shares;
      // const newYes = market.yesPool + (side === "YES" ? tradedShares : 0);
      // const newNo = market.noPool + (side === "NO" ? tradedShares : 0);
      const newYes = market.yesPool + (side === "YES" ? tradedShares : 0);
      const newNo = market.noPool + (side === "NO" ? tradedShares : 0);
      if (mutateMarket) {
        mutateMarket((prev: Market) => ({
          ...prev,
          yesPool: newYes,
          noPool: newNo,
        }));
      }

      toast.success(
        `Bought ${tradedShares.toFixed(2)} shares @ ${(
          priceAfter * 100
        ).toFixed(2)} %`
      );
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setPending(false);
    }
  }, [
    market.id,
    side,
    cost,
    mutateMarket,
    shares,
    priceAfter,
    onClose,
    market.yesPool,
    market.noPool,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setSpend((s) => Math.max(0, s - 10));
      if (e.key === "ArrowRight") setSpend((s) => Math.min(maxSpend, s + 10));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, maxSpend]);

  const fmt = useMemo(() => new Intl.NumberFormat(), []);

  return (
    <div className="border-[1px] border-white px-8 py-6 space-y-4 bg-white bg-opacity-20 rounded-xl shadow-md">
      <div className="flex justify-between">
        <button
          className={`likebutton px-4 pt-1 pb-0 rounded-xl ${
            side === "NO" ? "bg-red-500 text-white" : "bg-white bg-opacity-40"
          }`}
          onClick={() => setSide("NO")}
        >
          NO
        </button>
        <button
          className={`likebutton px-4 pt-1 pb-0 rounded-xl ${
            side === "YES"
              ? "bg-green-500 text-white"
              : "bg-white bg-opacity-40"
          }`}
          onClick={() => setSide("YES")}
        >
          YES
        </button>
      </div>
      <div className="justify-center items-center mx-auto text-center space-y-2">
        <Slider
          min={0}
          max={Math.max(10, maxSpend)}
          step={10}
          value={[spend]}
          onValueChange={([v]) => setSpend(Number.isFinite(v) ? Number(v) : 0)}
          className="w-full"
        />
        {typeof error === "string" && (
          <Alert variant="destructive">{error}</Alert>
        )}
        <div className="text-sm text-gray-700" aria-live="polite">
          {/* Cost: {cost} credits — New balance: {maxSpend - cost} */}
          {/* Cost: {Number.isFinite(cost) ? cost : "--"}  */}
          Cost: {spend} credits — New balance: {maxSpend - spend}
          {/* credits —
        New balance: {Number.isFinite(cost) ? maxSpend - cost : "--"} */}
        </div>
        <div className="text-sm text-gray-700" aria-live="polite">
          You receive ≈ {shares.toFixed(2)} shares
        </div>
        <div className="text-sm text-gray-700" aria-live="polite">
          Market moves to ≈{" "}
          {Number.isFinite(priceAfter) ? (priceAfter * 100).toFixed(1) : "--"}
           % YES{" "}
        </div>

        <button
          onClick={handleTrade}
          // disabled={pending || cost <= 0 || cost > maxSpend}
          disabled={pending || spend <= 0 || spend > maxSpend}
          //disabled={pending || spend <= 0 || spend > maxSpend || maxSpend === 0}
          className="w-fit h-full px-6 py-3 bg-white bg-opacity-40 rounded-xl tracking-wide mx-auto likebutton"
        >
          {pending ? <Spinner className="h-4 w-4" /> : "Confirm Trade"}
        </button>
      </div>
    </div>
  );
}
