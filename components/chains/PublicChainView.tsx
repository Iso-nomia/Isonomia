"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListTree, FileText, BookOpen, Layers, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArgumentChainWithRelations } from "@/lib/types/argumentChain";
import { ArgumentChainThread } from "./ArgumentChainThread";
import { ChainProseView } from "./ChainProseView";
import { ChainEssayView } from "./ChainEssayView";

export type ChainView = "thread" | "prose" | "essay";

export interface PublicChainViewProps {
  chain: ArgumentChainWithRelations;
  /** Worst-link standing across the chain (from computeChainExposure). */
  standing?: string | null;
  /** Weakest-link descriptor (from computeChainExposure). */
  weakestLink?: { argumentId: string; reason: string } | null;
  /** Initial view, seeded from the `?view=` query param. */
  initialView?: ChainView;
  /** Base app URL for deliberation deep-links. */
  baseUrl: string;
}

const VIEWS: { key: ChainView; label: string; icon: React.ReactNode }[] = [
  { key: "thread", label: "Thread", icon: <ListTree className="w-4 h-4" /> },
  { key: "prose", label: "Brief", icon: <FileText className="w-4 h-4" /> },
  { key: "essay", label: "Essay", icon: <BookOpen className="w-4 h-4" /> },
];

function standingLabel(standing?: string | null): string | null {
  if (!standing) return null;
  return standing
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PublicChainView({
  chain,
  standing,
  weakestLink,
  initialView = "thread",
  baseUrl,
}: PublicChainViewProps) {
  const router = useRouter();
  const [view, setView] = useState<ChainView>(initialView);

  const handleSwitch = useCallback(
    (next: ChainView) => {
      setView(next);
      // Shallow-update the URL so the chosen view is shareable, without a
      // data refetch (every view receives the same server-hydrated chain).
      const params = new URLSearchParams(window.location.search);
      params.set("view", next);
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  const nodeCount = chain.nodes?.length ?? 0;
  const standingText = standingLabel(standing);

  return (
    <div className="space-y-6">
      {/* Header band */}
      <header className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-widest uppercase bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 border border-indigo-500/20">
            <Layers className="w-3 h-3" />
            {chain.chainType}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-500">
            {nodeCount} {nodeCount === 1 ? "argument" : "arguments"}
          </span>
          {chain.deliberation?.title && (
            <>
              <span className="text-slate-300">·</span>
              <Link
                href={`${baseUrl}/deliberations/${chain.deliberation.id}`}
                className="text-xs text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {chain.deliberation.title}
              </Link>
            </>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">
          {chain.name}
        </h1>
        {chain.description && (
          <p className="text-sm text-slate-600 leading-relaxed">
            {chain.description}
          </p>
        )}

        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {chain.creator?.name && (
            <div className="flex items-center gap-2">
              {chain.creator.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chain.creator.image}
                  alt={chain.creator.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600">
                  {chain.creator.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-slate-600">{chain.creator.name}</span>
            </div>
          )}

          {standingText && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-600">
                Standing: <span className="font-medium">{standingText}</span>
              </span>
              <span className="text-[10px] text-slate-400">
                (provisional until challenged)
              </span>
            </div>
          )}
        </div>

        {weakestLink?.reason && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="font-semibold">Weakest link:</span>{" "}
            {weakestLink.reason}
          </p>
        )}
      </header>

      {/* View switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => handleSwitch(v.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              view === v.key
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Body — every view receives initialData so none issue the auth-gated fetch */}
      <div>
        {view === "thread" && (
          <ArgumentChainThread
            chainId={chain.id}
            initialData={chain}
            showHeader={false}
            compact={false}
          />
        )}
        {view === "prose" && (
          <ChainProseView chainId={chain.id} initialData={chain} />
        )}
        {view === "essay" && (
          <ChainEssayView chainId={chain.id} initialData={chain} />
        )}
      </div>
    </div>
  );
}
