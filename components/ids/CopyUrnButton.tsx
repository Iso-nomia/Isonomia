'use client';
export default function CopyUrnButton({ urn }: { urn?: string }) {
  if (!urn) return null;
  return (
    <button
      className="text-xs text-neutral-600 underline"
      onClick={() => navigator.clipboard.writeText(urn)}
      title="Copy URN"
    >
      Copy URN
    </button>
  );
}
