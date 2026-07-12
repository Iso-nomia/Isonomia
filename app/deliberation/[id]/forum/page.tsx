// app/deliberation/[id]/forum/page.tsx
import ForumLens from "./ui/ForumLens";

export default function Page({ params }: { params: { id: string } }) {
  return <ForumLens deliberationId={params.id} />;
}
