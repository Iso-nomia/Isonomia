'use client';
import * as React from 'react';
import type { UIAttachment } from './FacetChipBar';

export function AttachmentList({
  items, onRemove, onUploadOne,
}: {
  items: UIAttachment[];
  onRemove: (sha256: string) => void;
  onUploadOne?: (att: UIAttachment) => Promise<{ path: string }>;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);

  async function handleUpload(a: UIAttachment) {
    if (!onUploadOne || !a.file) return;
    setBusy(a.sha256);
    try {
      const { path } = await onUploadOne(a);
      a.path = path; // mutate local copy; parent holds reference
    } finally {
      setBusy(null);
    }
  }

  if (!items?.length) return null;
  return (
    <div className="rounded-md border bg-white/60 p-2 text-xs">
      <div className="mb-1 font-medium">Attachments</div>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.sha256} className="flex items-center gap-2">
            <span className="truncate">{a.name}</span>
            <span className="text-slate-500">({Math.ceil(a.size/1024)} KB)</span>
            {a.path
              ? <span className="ml-auto px-2 py-0.5 rounded bg-green-100 text-green-800">uploaded</span>
              : <button
                  type="button"
                  onClick={() => handleUpload(a)}
                  disabled={!onUploadOne || !a.file || busy === a.sha256}
                  className="ml-auto px-2 py-0.5 rounded bg-white/70 border"
                >
                  {busy === a.sha256 ? 'Uploading…' : 'Upload'}
                </button>}
            <button type="button" className="px-2 py-0.5 rounded bg-white/70 border" onClick={() => onRemove(a.sha256)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
