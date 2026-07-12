//app/claim/[id]/page.tsx
import { prisma } from '@/lib/prismaclient';
import { notFound } from 'next/navigation';
import ClaimDetail from '@/components/claims/ClaimDetail';



export default async function Page({ params }: { params: { id: string } }) {
  const claim = await prisma.claim.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      text: true,
      moid: true,
      createdAt: true,
      deliberation: {
        select: {
          hostType: true,
          hostId: true,
        },
      },
      // ✅ CORRECTED: Selecting fields that exist on the ClaimCitation model
      citations: {
        select: {
          id: true,
          uri: true,      // Was 'url'
          note: true,     // Was 'comment'
          cslJson: true,  // Example of another available field
        },
      },
      // ✅ CORRECTED: Selecting fields that exist on the CanonicalClaim model
      canonical: {
        select: {
          id: true,
          slug: true,     // Useful for creating a link
          title: true,    // Was 'text'
          summary: true,
        },
      },
    },
  });

  if (!claim) {
    notFound();
  }

  let backHref: string | undefined;
  if (claim.deliberation?.hostType === 'article' && claim.deliberation.hostId) {
    // This assumes you have an 'article' model. If not, this logic may need adjustment.
    const article = await prisma.article.findUnique({
      where: { id: claim.deliberation.hostId },
      select: { slug: true },
    });
    if (article?.slug) {
      backHref = `/article/${article.slug}`;
    }
  }

  // Map Prisma citations to Citation[] shape expected by ClaimDetail
  const mappedCitations = claim.citations.map((citation) => ({
    id: citation.id,
    sourceName: citation.uri || "", // Use uri as sourceName or provide logic to extract name
    url: citation.uri,
    comment: citation.note ?? "",
    cslJson: citation.cslJson,
  }));

  // Map canonical to CanonicalClaim type
  const canonicalClaim = claim.canonical
    ? { id: claim.canonical.id, text: claim.canonical.title }
    : null;

  return (
    <ClaimDetail
      id={claim.id}
      text={claim.text}
      moid={claim.moid}
      createdAt={claim.createdAt}
      backHref={backHref}
      citations={mappedCitations}
      canonical={canonicalClaim}
    />
  );
}