// app/works/[id]/view/page.tsx
import { prisma } from '@/lib/prismaclient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WorkViewPage({
  params, searchParams
}: {
  params: { id: string },
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const id = params.id;
  const mode = (Array.isArray(searchParams?.mode) ? searchParams?.mode[0] : searchParams?.mode) ?? 'full';

  const work = await prisma.theoryWork.findUnique({
    where: { id },
    select: {
      id: true, title: true, slug: true, summary: true, body: true,
      theoryType: true, authorId: true, deliberationId: true,
      status: true, visibility: true, standardOutput: true,
      createdAt: true, updatedAt: true, publishedAt: true,
      dnStructure: { select: { explanandum: true, nomological: true, ceterisParibus: true } },
      ihTheses:    { select: { structure: true, function: true, objectivity: true } },
      tcTheses:    { select: { instrumentFunction: true, explanation: true, applications: true } },
      opTheses:    { select: { unrecognizability: true, alternatives: true } },
      hermeneuticProject:        { select: { corpusUrl: true, facts: true, hypotheses: true, plausibility: true, selectedIds: true } },
      practicalJustification:    { select: { result: true, purpose: true } },
      pascalModel:               { select: { decision: true, propositions: true, actions: true, assumption: true } },
    }
  });
  if (!work) return <div className="p-6 text-sm text-rose-600">Work not found.</div>;
  const w = work;

  const isIH = w.theoryType === 'IH';
  const isDN = w.theoryType === 'DN';
  const isTC = w.theoryType === 'TC';
  const isOP = w.theoryType === 'OP';

  function Pill({ children }: { children: React.ReactNode }) {
    return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] text-neutral-700 bg-white">{children}</span>;
  }
  function Section({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
      <section className="rounded-lg border bg-white p-4 space-y-2">
        <div className="text-sm font-semibold">{title}</div>
        {children}
      </section>
    );
  }
  function IhSummary() {
    const ih = (w.ihTheses ?? {}) as { structure?: string | null; function?: string | null; objectivity?: string | null };
    const H = (w.hermeneuticProject as any) || {};
    const PJ = (w.practicalJustification?.result as any) || {};
    const selIds: string[] = Array.isArray(H.selectedIds) ? H.selectedIds : [];
    const facts: any[] = Array.isArray(H.facts) ? H.facts : [];
    const hyps:  any[] = Array.isArray(H.hypotheses) ? H.hypotheses : [];
    const byId = new Map<string,string>();
    facts.forEach((f:any)=> f?.id && byId.set(f.id, f.text));
    hyps.forEach((h:any)=> h?.id && byId.set(h.id, h.text));
    const picked = selIds.slice(0,5).map(id => byId.get(id)).filter(Boolean) as string[];
    const best = PJ?.bestOptionId ? `Best option: ${PJ.bestOptionId}` : null;

    return (
      <div className="text-sm leading-relaxed space-y-2">
        {w.standardOutput && <div><b>Standard Output:</b> {w.standardOutput}</div>}
        {(ih.structure || ih.function || ih.objectivity) && (
          <ul className="list-disc pl-5">
            {ih.structure && <li><b>Structure:</b> {ih.structure}</li>}
            {ih.function && <li><b>Function:</b> {ih.function}</li>}
            {ih.objectivity && <li><b>Objectivity:</b> {ih.objectivity}</li>}
          </ul>
        )}
        {picked.length > 0 && (
          <div><b>Hermeneutic highlights:</b> {picked.join(' · ')}</div>
        )}
        {best && <div><b>Practical summary:</b> {best}</div>}
      </div>
    );
  }

  // COMPACT IH MODE
  if (mode === 'compact' && isIH) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50/40 to-slate-50/40">
        <div className="mx-auto max-w-3xl p-6 space-y-4">
          <div className="rounded-lg border bg-white p-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{w.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Pill>IH</Pill>
                {w.publishedAt && <Pill>Published {new Date(w.publishedAt).toLocaleDateString()}</Pill>}
              </div>
            </div>
            <Link
              href={`/api/works/${w.id}/dossier?format=md&lens=ih`}
              className="text-xs underline"
            >
              Export IH Summary (MD)
            </Link>
          </div>
          <Section title="IH Summary"><IhSummary /></Section>
        </div>
      </div>
    );
  }

  // FULL MODE
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50/40 to-slate-50/40">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold">{w.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Pill>{w.theoryType}</Pill>
                <Pill>{w.status}</Pill>
                {w.publishedAt && <Pill>Published {new Date(w.publishedAt).toLocaleDateString()}</Pill>}
               
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link
                href={`/api/works/${w.id}/dossier?format=md${isIH ? '&lens=ih' : ''}`}
                className="text-xs underline"
                prefetch={false}
              >
                Export {isIH ? 'IH Summary (MD)' : 'Dossier (MD)'}
              </Link>
            </div>
          </div>
        </div>

        {w.summary && <Section title="Abstract"><div className="text-sm">{w.summary}</div></Section>}
        {w.body && <Section title="Body"><div className="prose prose-sm max-w-none whitespace-pre-wrap">{w.body}</div></Section>}

        {isDN && (
          <Section title="DN — Explanatory Structure">
            <ul className="list-disc pl-5 text-sm">
              {w.dnStructure?.explanandum && <li><b>Explanandum:</b> {w.dnStructure.explanandum}</li>}
              {w.dnStructure?.nomological && <li><b>Laws / Regularities:</b> {w.dnStructure.nomological}</li>}
              {w.dnStructure?.ceterisParibus && <li><b>Ceteris paribus:</b> {w.dnStructure.ceterisParibus}</li>}
            </ul>
          </Section>
        )}

        {isIH && (
          <>
            <Section title="IH — Theses">
              <ul className="list-disc pl-5 text-sm">
                {w.ihTheses?.structure && <li><b>Structure:</b> {w.ihTheses.structure}</li>}
                {w.ihTheses?.function && <li><b>Function:</b> {w.ihTheses.function}</li>}
                {w.ihTheses?.objectivity && <li><b>Objectivity:</b> {w.ihTheses.objectivity}</li>}
              </ul>
              {w.standardOutput && <div className="mt-2 text-sm"><b>Standard Output:</b> {w.standardOutput}</div>}
            </Section>
            <Section title="Hermeneutic Highlights"><IhSummary /></Section>
          </>
        )}

        {isTC && (
          <Section title="TC — Instrument & Operation">
            <ul className="list-disc pl-5 text-sm">
              {w.tcTheses?.instrumentFunction && <li><b>Instrument Function:</b> {w.tcTheses.instrumentFunction}</li>}
              {w.tcTheses?.explanation && <li><b>Explanation of Functioning:</b> {w.tcTheses.explanation}</li>}
              {!!(w.tcTheses?.applications?.length) && <li><b>Applications:</b> {w.tcTheses.applications?.join(', ')}</li>}
            </ul>
            {w.standardOutput && <div className="mt-2 text-sm"><b>Standard Output:</b> {w.standardOutput}</div>}
          </Section>
        )}

        {isOP && (
          <>
            <Section title="OP — Unrecognizability & Alternatives">
              <ul className="list-disc pl-5 text-sm">
                {w.opTheses?.unrecognizability && <li><b>Unrecognizability Justification:</b> {w.opTheses.unrecognizability}</li>}
                {!!(w.opTheses?.alternatives?.length) && <li><b>Considered Alternatives:</b> {w.opTheses.alternatives?.join(', ')}</li>}
              </ul>
            </Section>
            {w.pascalModel && (
              <Section title="Pascal Decision (as-if)">
                <div className="text-sm">
                  {w.pascalModel.assumption && <div><b>Assumption:</b> {w.pascalModel.assumption}</div>}
                  {(w.pascalModel.decision as any)?.bestActionId && <div><b>Best action:</b> {String((w.pascalModel.decision as any).bestActionId)}</div>}
                </div>
              </Section>
            )}
          </>
        )}

        {(isIH || isTC) && w.practicalJustification?.result && (
          <Section title="Practical Justification — MCDA Snapshot">
            <div className="text-sm">
              {(() => {
                const r = w.practicalJustification?.result as any;
                return (
                  <>
                    <div><b>Best option:</b> {r?.bestOptionId ?? '—'}</div>
                    {r?.totals && <div className="text-[11px] text-neutral-600">Options scored: {Object.keys(r.totals).length}</div>}
                  </>
                );
              })()}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
