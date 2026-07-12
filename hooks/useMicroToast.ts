// hooks/useMicroToast.ts
"use client";
import * as React from "react";

/**
 * Lightweight toast notification hook.
 * Returns { show, node } where:
 * - show(text, kind, ms) displays a toast
 * - node is the React element to render in your component
 */
export function useMicroToast() {
  const [msg, setMsg] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  
  const show = React.useCallback((text: string, kind: "ok" | "err" = "ok", ms = 4000) => {
    setMsg({ kind, text });
    const id = setTimeout(() => setMsg(null), ms);
    return () => clearTimeout(id);
  }, []);
  
  const node = msg
    ? React.createElement(
        "div",
        {
          className: [
            "fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur bg-white/95 animate-in slide-in-from-bottom-2",
            msg.kind === "ok"
              ? "border-emerald-300 text-emerald-800 bg-emerald-50/95"
              : "border-rose-300 text-rose-800 bg-rose-50/95",
          ].join(" "),
        },
        React.createElement(
          "div",
          { className: "flex items-center gap-2" },
          React.createElement("span", { className: "text-base" }, msg.kind === "ok" ? "✓" : "✕"),
          React.createElement("span", { className: "font-medium" }, msg.text)
        )
      )
    : null;
  
  return { show, node };
}
