// app/deliberations/[id]/thesis/[thesisId]/page.tsx
import ThesisEditor from "@/components/thesis/ThesisEditor";

export default function EditThesisPage({
  params,
}: {
  params: { id: string; thesisId: string };
}) {
  return <ThesisEditor thesisId={params.thesisId} deliberationId={params.id} />;
}
