import { FacilitationReport } from "@/components/facilitation/FacilitationReport";

export const dynamic = "force-dynamic";

export default function FacilitationReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { sessionId?: string };
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <FacilitationReport
        deliberationId={params.id}
        sessionId={searchParams?.sessionId ?? null}
      />
    </main>
  );
}
