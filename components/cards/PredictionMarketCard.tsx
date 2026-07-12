"use client";
import TradePredictionModal from "../modals/TradePredictionModal";
import ResolveMarketDialog from "@/apps/web/src/components/modals/ResolveMarketDialog";
import { useMarket } from "@/hooks/useMarket";
import { priceYes } from "@/lib/prediction/lmsr";
import { timeUntil } from "@/lib/utils";
import { useState } from "react";
import { Market } from "@/lib/types/prediction";
import dynamic from "next/dynamic";

const TimeRemaining = dynamic(
  () => import("@/components/TimeRemaining"),   // correct path
  { ssr: false }                                // don’t SSR this component
);

function coerce(m: Market): Market {
  return {
    ...m,
    yesPool : Number(m.yesPool),
    noPool  : Number(m.noPool),
    b       : Number(m.b),
    
    closesAt: typeof m.closesAt === "string"
                ? new Date(m.closesAt)
                : m.closesAt,
    closedAt: typeof m.closedAt === "string"
                ? new Date(m.closedAt)
                : m.closedAt,
    resolvesAt: typeof m.resolvesAt === "string"
                ? new Date(m.resolvesAt)
                : m.resolvesAt,
  };
}


interface Props {
  post: any;
}


export default function PredictionMarketCard({ post }: Props) {
  // const { data: marketData, mutate } = useMarket(post.predictionMarket.id);
  // const market = marketData?.market;
  //const { data: market, mutate } = useMarket(post.predictionMarket.id);
  // const initialMarket = post.predictionMarket as Market;
  const initialMarket = coerce(post.predictionMarket);

  const { data: liveMarket, mutate } = useMarket(initialMarket.id, initialMarket);
  const market = coerce(liveMarket as Market);   // live is defined thanks to fallback



  
  // const { data: market, mutate } = useMarket(
  //   post.predictionMarket.id,
  //   post.predictionMarket           // ← initial data
  // );
  const safe = (n: number | undefined | null) =>
    Number.isFinite(n!) ? n! : 0;
  const bVal = safe(market?.b);
  const yVal = safe(market?.yesPool);
  const nVal = safe(market?.noPool);
  const price = bVal > 0 ? priceYes(yVal, nVal, bVal) : 0.5;
  //const closesAt = market?.closesAt ?? post.predictionMarket?.closesAt;

  const countdown =
  market.closesAt ? timeUntil(market.closesAt) : "--";

  const state = market?.state ?? post.predictionMarket.state;
  const outcome = market?.outcome ?? post.predictionMarket.outcome;
  // const canResolve = marketData?.canResolve ?? false;
  const canResolve = market?.canResolve ?? false;
  const [showTrade, setShowTrade] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const mId = market?.id ?? post.predictionMarket.id;

  return (
    <div className="border-[1px] border-sky-200 border-opacity-30  w-[700px] bg-white bg-opacity-10
     justify-center items-center mx-auto rounded-xl p-6 space-y-3 shadow-md">
      <h3 className=" text-[1.2rem] tracking-wide">{post.predictionMarket?.question}</h3>
      <div className="h-3 w-full rounded bg-gray-200 relative items-center justify-center mx-auto  overflow-hidden">
        <div
          className="bg-green-500 absolute inset-y-0 left-0"
          style={{ width: `${price * 100}%` }}
        />
      </div>
      <div className="text-xs text-gray-600 ">
  {Number.isFinite(price) ? Math.round(price * 100) + " % YES" : "--"}
</div>
     <div className="items-center justify-center mx-auto ">
      
     {state === "OPEN"  && (
          <button
            className="likebutton bg-white bg-opacity-20 py-2 px-8 mt-1 mb-3  rounded-xl text-[1.1rem] mx-full items-center justify-center text-center tracking-widest"
            onClick={() => setShowTrade(true)}
          >
            Trade
          </button>
        )}
        {state === "CLOSED" && canResolve && (
          <button
            className="likebutton bg-white bg-opacity-20 py-2 px-8 mt-1 mb-2 rounded-xl text-[1.1rem] mx-full items-center justify-center text-center tracking-widest"
            onClick={() => setShowResolve(true)}
          >
            Resolve
          </button>
        )}
      </div>
      {state === "OPEN" && (
  // <span className="text-xs p-4 mt-4">Closes in {countdown}</span>
  <TimeRemaining closesAt={market.closesAt} />

  )}
      { showTrade && (

        <TradePredictionModal
        market={{ ...post.predictionMarket, ...market, id: mId }}
          onClose={() => setShowTrade(false)}
          mutateMarket={mutate}
        />
       )} 
      {state === "CLOSED" && !canResolve && (
        <div className="text-[sm] font-medium">Awaiting resolution</div>
      )}
      {showResolve && (
        <ResolveMarketDialog
          marketId={post.predictionMarket.id}
          onResolved={() => {
            mutate();
            setShowResolve(false);
          }}
        />
      )}
      {state === "RESOLVED" && (
        <div className="text-[sm] font-medium">Resolved: {outcome}</div>
      )}
    </div>
  );
}
