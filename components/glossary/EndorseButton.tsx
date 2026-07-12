// components/glossary/EndorseButton.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import useSWR from "swr";
import { ThumbsUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface EndorseButtonProps {
  definitionId: string;
  endorsementCount: number;
  onEndorsed: () => void;
  size?: "sm" | "default";
}

export function EndorseButton({
  definitionId,
  endorsementCount: initialCount,
  onEndorsed,
  size = "default",
}: EndorseButtonProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [count, setCount] = useState(initialCount);

  // Check if user has endorsed
  const { data: voteData } = useSWR(
    user ? `/api/glossary/definitions/${definitionId}/endorse/check` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isEndorsed = voteData?.endorsed || false;

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation(); // Prevent card click
    
    if (!user) {
      alert("Please sign in to endorse definitions");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/glossary/definitions/${definitionId}/endorse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCount(data.endorsementCount);
        onEndorsed();
      } else {
        console.error("Failed to toggle endorsement");
      }
    } catch (error) {
      console.error("Error toggling endorsement:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading || !user}
      className={cn(
        "group relative overflow-hidden flex items-center gap-1.5 rounded-lg transition-all duration-300",
        "backdrop-blur-md border shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        isEndorsed
          ? "bg-gradient-to-r from-cyan-500/30 to-indigo-500/30 border-cyan-400/60 text-cyan-100 shadow-cyan-500/20"
          : "bg-white/10 border-white/20 text-slate-300 hover:bg-white/15 hover:border-white/30"
      )}
    >
      {/* Glass shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
      
      <div className="relative flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className={cn("animate-spin", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
        ) : (
          <ThumbsUp
            className={cn(
              "transition-transform group-hover:scale-110",
              size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5",
              isEndorsed && "fill-current"
            )}
          />
        )}
        <span className="font-semibold">{count}</span>
      </div>
      
      {/* Glow effect when endorsed */}
      {isEndorsed && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-indigo-400/20 blur-md opacity-50 pointer-events-none" />
      )}
    </button>
  );
}
