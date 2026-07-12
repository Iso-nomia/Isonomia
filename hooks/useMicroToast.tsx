// hooks/useMicroToast.tsx
"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import type { ToastKind, ToastMessage } from "@/types/dialogue";

/**
 * Lightweight toast notification hook for dialogue components
 * 
 * Usage:
 * ```tsx
 * const toast = useMicroToast();
 * toast.show("Success!", "ok");
 * return <>{toast.node}</>;
 * ```
 */
export function useMicroToast() {
  const [msg, setMsg] = useState<ToastMessage | null>(null);

  const show = useCallback(
    (text: string, kind: ToastKind = "ok", ms = 4000) => {
      setMsg({ kind, text });
      const id = setTimeout(() => setMsg(null), ms);
      return () => clearTimeout(id);
    },
    []
  );

  const dismiss = useCallback(() => {
    setMsg(null);
  }, []);

  const node = msg ? (
    <div
      className={[
        "fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur bg-white/95 animate-in slide-in-from-bottom-2",
        msg.kind === "ok"
          ? "border-emerald-300 text-emerald-800 bg-emerald-50/95"
          : msg.kind === "err"
          ? "border-rose-300 text-rose-800 bg-rose-50/95"
          : msg.kind === "warn"
          ? "border-amber-300 text-amber-800 bg-amber-50/95"
          : "border-blue-300 text-blue-800 bg-blue-50/95",
      ].join(" ")}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="text-base">
          {msg.kind === "ok"
            ? "✓"
            : msg.kind === "err"
            ? "✕"
            : msg.kind === "warn"
            ? "⚠"
            : "ℹ"}
        </span>
        <span className="font-medium">{msg.text}</span>
        <button
          onClick={dismiss}
          className="ml-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  ) : null;

  return { show, dismiss, node };
}
