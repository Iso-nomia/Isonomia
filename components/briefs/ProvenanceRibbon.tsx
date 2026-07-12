'use client';
export default function ProvenanceRibbon({
  coveragePct, sourceCount, primaryCount, lastVerify,
}: { coveragePct: number | null; sourceCount: number | null; primaryCount: number | null; lastVerify: string | null; }) {
  const pct = typeof coveragePct === 'number' ? Math.round(coveragePct * 100) : null;
  const line = [
    pct !== null ? `${pct}% primary` : null,
    sourceCount ? `${sourceCount} sources` : null,
    lastVerify ? `last verify ${lastVerify}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="text-xs text-neutral-600 bg-neutral-50 border rounded px-2 py-1 inline-block">
      {line || 'Provenance — no data'}
    </div>
  );
}
