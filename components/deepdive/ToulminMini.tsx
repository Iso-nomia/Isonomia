// components/deepdive/ToulminMini.tsx
'use client';
import useSWR from 'swr';

type ToulminData = {
  claim: { id: string; text: string };
  grounds: { id: string; text: string }[];
  rebuttals: { id: string; text: string; scope: 'premise'|'inference'|'conclusion'|null }[];
  undercuts: { id: string; text: string }[];
  backing: { schemes: { key: string; name?: string | null; icon?: string; count: number }[]; citations: number; evidence: number };
  qualifier: { quantifier?: 'SOME'|'MANY'|'MOST'|'ALL'; modality?: 'COULD'|'LIKELY'|'NECESSARY'; confidenceAvg: number | null };
  warrant: string | null;   // explicit warrant text if provided

};
function iconForScheme(key?: string | null): string {
  switch (key) {
    case 'expert_opinion':
      return '∴';   // therefore
    case 'good_consequences':
      return '⇒';   // implies
    case 'analogy':
      return '≈';   // approximate equality
    default:
      return '□';   // generic square
  }
}
const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export default function ToulminMini({ claimId }: { claimId: string }) {
  const { data, error, isLoading } = useSWR<ToulminData>(
    claimId ? `/api/claims/${claimId}/toulmin` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) return <div className="text-xs text-neutral-500 border rounded p-3">Loading Toulmin…</div>;
  if (error || !data) return <div className="text-xs text-rose-600 border rounded p-3">Failed to load Toulmin.</div>;

   const { claim, grounds, rebuttals, undercuts, backing, qualifier, warrant } = data;
  const hasWarrantIssue = (undercuts?.length ?? 0) > 0;

  return (
    <div className="w-full border rounded-lg p-3 bg-white/90 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold">Toulmin</div>
        <div className="text-[11px] text-neutral-500">Claim mini-diagram</div>
      </div>

      {/* Grid 3x2 */}
      <div className="grid grid-cols-3 gap-2">
        {/* Claim */}
        <Slot title="Claim">
          <p className="leading-snug">{claim.text}</p>
        </Slot>

        {/* Grounds */}
        <Slot title="Grounds">
          {grounds.length ? (
            <ul className="list-disc ml-4 space-y-1">
              {grounds.slice(0, 3).map(g => <li key={g.id} className="leading-snug">{g.text}</li>)}
            </ul>
          ) : <Empty>—</Empty>}
        </Slot>

        {/* Warrant */}
        <Slot title="Warrant">
  {warrant ? (
    <div className="text-[12px] text-neutral-700 mb-1">{warrant}</div>
  ) : null}

  {undercuts.length > 0 && (
    <div className="text-[12px] text-rose-700">
<span
  title="This claim’s warrant is challenged by counter-claims (undercuts)."
>
  <Badge color="violet">contested</Badge>
</span>      <ul className="list-disc ml-4 mt-1 space-y-1">
        {undercuts.slice(0, 2).map(u => (
          <li key={u.id}>{u.text}</li>
        ))}
      </ul>
    </div>
  )}

  {!warrant && undercuts.length === 0 && (
    <div className="text-[12px] text-neutral-700">
      <Badge color="slate">inferred</Badge>{' '}
      If grounds hold, then (normally) the claim follows.
    </div>
  )}
</Slot>


        {/* Backing */}
<Slot title="Backing">
  <div className="flex flex-wrap items-center gap-2">
    {backing.schemes.length ? backing.schemes.slice(0, 3).map(s => (
      <div key={s.key} className="flex items-center gap-1 border rounded px-2 py-0.5">
        <span className="font-serif text-lg">{iconForScheme(s.key)}</span>
        <span className="text-[12px]">{s.name ?? s.key}</span>
        {s.count > 1 && (
          <span className="text-[11px] text-neutral-500">×{s.count}</span>
        )}
      </div>
    )) : <Empty>—</Empty>}
  </div>
  {(backing.citations > 0 || backing.evidence > 0) && (
    <div className="text-[11px] text-neutral-500 mt-1">
      {backing.citations > 0 && <span>{backing.citations} citation{backing.citations>1?'s':''}</span>}
      {backing.citations > 0 && backing.evidence > 0 && <span> · </span>}
      {backing.evidence > 0 && <span>{backing.evidence} evidence link{backing.evidence>1?'s':''}</span>}
    </div>
  )}
</Slot>

        {/* Qualifier */}
        <Slot title="Qualifier">
  {qualifier.quantifier || qualifier.modality || qualifier.confidenceAvg != null ? (
    <div className="flex flex-col gap-2 text-[12px]">
      <div className="flex flex-wrap gap-2">
        {qualifier.quantifier && <Chip color="blue">{qualifier.quantifier}</Chip>}
        {qualifier.modality && <Chip color="violet">{qualifier.modality}</Chip>}
      </div>
      {qualifier.confidenceAvg != null && (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 bg-slate-200 rounded">
            <div
              className="h-2 bg-emerald-500 rounded"
              style={{ width: `${qualifier.confidenceAvg * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-neutral-600 min-w-[40px] text-right">
            {(qualifier.confidenceAvg * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  ) : <Empty>—</Empty>}
</Slot>

        {/* Rebuttal */}
        <Slot title="Rebuttal">
          {rebuttals.length ? (
            <ul className="space-y-1">
              {rebuttals.slice(0, 3).map(r => (
                <li key={r.id} className="leading-snug">
                  <Scope scope={r.scope} /> {r.text}
                </li>
              ))}
            </ul>
          ) : <Empty>—</Empty>}
        </Slot>
      </div>
    </div>
  );
}

function Slot({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-2 bg-white">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{title}</div>
      <div className="text-[13px] text-neutral-800">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-neutral-400">{children}</span>;
}

function Chip({ children, color = "slate" }: { children: React.ReactNode; color?: "slate"|"blue"|"violet" }) {
  const map = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return <span className={`px-1.5 py-0.5 rounded border text-[11px] ${map[color]}`}>{children}</span>;
}

function Badge({ color, children }: { color: 'violet' | 'slate'; children: React.ReactNode }) {
  const cls = color === 'violet'
    ? 'bg-violet-50 text-violet-700 border-violet-200'
    : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>;
}

function Scope({ scope }: { scope: 'premise'|'inference'|'conclusion'|null }) {
  if (!scope) return null;
  const map: Record<string, string> = {
    premise: 'P',
    inference: 'I',
    conclusion: 'C',
  };
  const color: Record<string, string> = {
    premise:   'bg-amber-50 text-amber-700 border-amber-200',
    inference: 'bg-violet-50 text-violet-700 border-violet-200',
    conclusion:'bg-blue-50 text-blue-700 border-blue-200',
  };
  return <span className={`text-[10px] px-1 py-0.5 rounded border mr-1 ${color[scope]}`}>{map[scope]}</span>;
}
