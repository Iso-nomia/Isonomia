// app/quick/page.tsx
"use client";

/**
 * Quick Argument Builder — Standalone Page
 *
 * Phase 2 (Step 2.5): A dedicated page at /quick for creating lightweight,
 * instantly-shareable arguments. Accepts optional query params for pre-filling:
 *   ?claim=<text>   — pre-fill the claim field
 *   ?url=<href>     — pre-fill the first evidence URL
 *
 * Linked from the browser extension and any "quick share" entry points.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { QuickArgumentBuilder } from "@/components/arguments/QuickArgumentBuilder";

function QuickPageInner() {
  const params = useSearchParams();
  const initialClaim = params?.get("claim") ?? "";
  const initialUrl = params?.get("url") ?? "";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-slate-900 hover:text-sky-600 transition-colors"
          >
            Isonomia
          </Link>
          <span className="text-sm text-slate-500">Quick Argument Builder</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Build an argument
          </h1>
          <p className="text-slate-500 text-sm">
            State your claim, add your sources, and get a shareable link in
            seconds.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <QuickArgumentBuilder
            initialClaim={initialClaim}
            initialUrl={initialUrl}
          />
        </div>

        <p className="text-xs text-slate-400 text-center">
          Arguments are saved to your{" "}
          <Link href="/arguments" className="underline hover:text-slate-600">
            My Arguments
          </Link>{" "}
          collection.{" "}
          <Link href="/help/embedding" className="underline hover:text-slate-600">
            Learn about embedding.
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function QuickPage() {
  return (
    <Suspense>
      <QuickPageInner />
    </Suspense>
  );
}
