import { InstitutionProfile } from "@/components/pathways/InstitutionProfile";

export const dynamic = "force-dynamic";

export default function InstitutionPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <InstitutionProfile institutionId={params.id} />
    </main>
  );
}
