"use client";

/**
 * FacilitationTab — C3.8
 *
 * Embeddable tab body for the deliberation page. Visible only when
 * `canManage` (host/facilitator) — the cockpit context endpoint exposes that
 * flag. Other roles see a read-only attestation header pointing to the
 * report page.
 */

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { FacilitationCockpit } from "@/components/facilitation/FacilitationCockpit";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

export function FacilitationTab({ deliberationId }: { deliberationId: string }) {
  const { data, isLoading } = useSWR<{ canManage: boolean }>(
    `/api/deliberations/${deliberationId}/facilitation/sessions`,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading…</div>;
  }
  if (!data?.canManage) {
    return (
      <div className="space-y-2 p-4 text-sm">
        <p className="text-slate-700">
          You don&apos;t have facilitator permissions on this deliberation.
        </p>
        <Button asChild className="bg-indigo-50" variant="outline">
          <Link
            href={`/deliberations/${deliberationId}/facilitation/report`}
          >
            View facilitation report
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)]">
      <FacilitationCockpit deliberationId={deliberationId} />
    </div>
  );
}
