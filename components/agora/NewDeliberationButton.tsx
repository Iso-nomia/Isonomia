"use client";

// Agora entry point for from-scratch deliberation creation
// (docs/DELIBERATION_CREATION_DEV_SPEC.md §4.1). Routes to the create surface;
// kept thin to avoid disturbing the Agora feed.

import * as React from "react";
import { useRouter } from "next/navigation";

export function NewDeliberationButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/create-deliberation")}
      className="btnv2 flex items-center gap-2 rounded-xl bg-white/50 px-3 py-3 text-[12px]"
    >
      ⊕ New Deliberation
    </button>
  );
}
