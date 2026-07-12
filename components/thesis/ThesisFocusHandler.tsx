"use client";

// components/thesis/ThesisFocusHandler.tsx
//
// Living Thesis — Phase 6.1: entry-point routing handler.
//
// Mounted inside <ThesisLiveProvider>. Reads `?focus=<idOrMoid>` and
// optional `?tab=` / `?hint=` from the URL, resolves the reference via
// /api/thesis/[id]/focus, scrolls the embedded element into view, and
// dispatches openInspector with the requested tab.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useOpenInspector, type InspectorRequest } from "@/lib/thesis/ThesisLiveContext";

type Kind = InspectorRequest["kind"];
type Tab = NonNullable<InspectorRequest["tab"]>;

const KINDS = new Set<Kind>(["claim", "argument", "proposition", "citation"]);
const TABS = new Set<Tab>([
  "overview",
  "attacks",
  "provenance",
  "evidence",
  "cqs",
  "history",
]);

export function ThesisFocusHandler({ thesisId }: { thesisId: string }) {
  const search = useSearchParams();
  const openInspector = useOpenInspector();
  const handledRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!search) return;
    const focus = search.get("focus")?.trim();
    if (!focus) return;

    const tabParam = search.get("tab")?.trim().toLowerCase() as Tab | null;
    const hintParam = search.get("hint")?.trim().toLowerCase() as Kind | null;
    const tab = tabParam && TABS.has(tabParam) ? tabParam : undefined;
    const hint = hintParam && KINDS.has(hintParam) ? hintParam : undefined;

    // Dedupe by full focus signature so re-renders don't re-trigger.
    const sig = `${focus}|${tab ?? ""}|${hint ?? ""}`;
    if (handledRef.current === sig) return;
    handledRef.current = sig;

    let cancelled = false;

    async function resolve() {
      try {
        const url = `/api/thesis/${thesisId}/focus?ref=${encodeURIComponent(focus!)}${
          hint ? `&hint=${hint}` : ""
        }`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { kind: Kind; id: string };
        if (cancelled || !data?.kind || !data?.id) return;

        // Scroll the embedded element into view (if it's actually in the doc).
        const sel = `[data-${data.kind}-id="${data.id}"]`;
        const el = document.querySelector<HTMLElement>(sel);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        // Open the inspector. Small delay so the scroll lands before the
        // sheet animates in.
        window.setTimeout(() => {
          openInspector({ kind: data.kind, id: data.id, tab });
        }, 120);
      } catch {
        // Silent — focus is best-effort.
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [search, thesisId, openInspector]);

  return null;
}
