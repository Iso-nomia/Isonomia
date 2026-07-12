/**
 * Test harness for AI-EPI Pt. 4 §6 e2e (deliberation-state-card.spec.ts).
 *
 * Mounts the IsonomiaWidget against a deliberationId from the query
 * string. Used by Playwright with `page.route()` mocks for the
 * deliberation endpoints.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { IsonomiaWidget } from "@/components/embeddable/IsonomiaWidget";

function Inner() {
  const sp = useSearchParams();
  const id = sp?.get("deliberationId") ?? "";
  if (!id) {
    return (
      <div className="p-8 text-sm text-slate-700">
        Pass <code>?deliberationId=&lt;id&gt;</code> to mount the widget.
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">
        AI-EPI Pt. 4 §6 — embeddable widget harness
      </h1>
      <IsonomiaWidget deliberationId={id} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
