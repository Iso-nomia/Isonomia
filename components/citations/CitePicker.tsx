// components/citations/CitePicker.tsx
'use client';
import { useState } from 'react';

export default function CitePicker({ claimId }: { claimId: string }) {
  const [url, setUrl] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [asBacking, setAsBacking] = useState(false);
  const [pending, setPending] = useState(false);

  function buildCslJSON() {
    const now = new Date();
    return {
      id: url,
      type: 'webpage',
      title: excerpt ? excerpt.slice(0, 120) : url,
      URL: url,
      accessed: { 'date-parts': [[now.getFullYear(), now.getMonth() + 1, now.getDate()]] },
    };
  }

  async function copyCsl() {
    try {
      const csl = buildCslJSON();
      await navigator.clipboard.writeText(JSON.stringify(csl, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e: any) {
      setStatus('Copy failed: ' + (e?.message ?? 'unknown'));
    }
  }

  async function snapshot() {
    if (!url.trim() || !excerpt.trim()) {
      setStatus('Please enter URL and exact excerpt.');
      return;
    }
    setPending(true);
    setStatus('Saving…');
    try {
      const snapRes = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, excerpt }),
      });
      const snap = await snapRes.json();
      if (!snapRes.ok || snap.error) throw new Error(snap.error ?? 'Snapshot failed');

      const cslJson = buildCslJSON();
      const citRes = await fetch(`/api/claims/${claimId}/citations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uri: url,
          excerptHash: snap.excerptHash,
          snapshotKey: snap.snapshotKey,
          cslJson,
          role: asBacking ? 'backing' : 'evidence',  // 👈 send the role
        }),
      });
      const cit = await citRes.json();
      if (!citRes.ok || cit.error) throw new Error(cit.error ?? 'Citation failed');

      setStatus('Saved ✓');
      setUrl('');
      setExcerpt('');
    } catch (e: any) {
      setStatus(e?.message ?? 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Mark as backing */}
      <label className="text-xs inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={asBacking}
          onChange={(e) => setAsBacking(e.target.checked)}
        />
        Mark as Backing (supports the warrant)
      </label>

      <input
        className="w-full border px-2 py-1 text-sm rounded"
        placeholder="Source URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <textarea
        className="w-full border px-2 py-1 text-sm rounded"
        rows={3}
        placeholder="Paste exact excerpt…"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <button
          className="text-xs px-2 py-1 rounded bg-amber-500 text-white disabled:opacity-50"
          onClick={snapshot}
          disabled={pending || !url || !excerpt}
        >
          {pending ? 'Attaching…' : 'Attach citation'}
        </button>

        <button
          className="text-xs px-2 py-1 rounded border hover:bg-slate-50 disabled:opacity-50"
          title="Copy a minimal CSL-JSON record for this citation"
          onClick={copyCsl}
          disabled={!url}
        >
          {copied ? 'CSL copied ✓' : 'Copy CSL JSON'}
        </button>
      </div>

      {status && <div className="text-xs text-neutral-600">{status}</div>}
    </div>
  );
}
