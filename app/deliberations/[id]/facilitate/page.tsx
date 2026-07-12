import { FacilitationCockpit } from "@/components/facilitation/FacilitationCockpit";

export const dynamic = "force-dynamic";

export default function FacilitatePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="h-screen min-h-0 overflow-hidden">
      <FacilitationCockpit deliberationId={params.id} />
    </main>
  );
}
