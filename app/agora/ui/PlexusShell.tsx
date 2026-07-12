"use client";

import React from "react";
import Plexus from "@/components/agora/Plexus";
import PlexusBoard from "@/components/agora/PlexusBoard";
import PlexusMatrix from "@/components/agora/PlexusMatrix";

export function PlexusShell({ scope = "public" }: { scope?: "public" | "following" }) {
  const [view, setView] = React.useState<"graph" | "board" | "matrix">("board"); // make Board the default

  return (
    <div className="space-y-2 p-2 ">
      <div className="flex w-full items-center gap-2">
        <div className="text-md px-2 font-semibold">Mode</div>
        <div className="ml-1 flex items-center gap-0">
          {(["board", "graph", "matrix"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1 text-[12px]  border border-indigo-300 ${
                view === v ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "board" && <PlexusBoard scope={scope} />}
      {view === "graph" && <Plexus scope={scope} />}
      {view === "matrix" && <PlexusMatrix scope={scope} />}
    </div>
  );
}

export default PlexusShell;
