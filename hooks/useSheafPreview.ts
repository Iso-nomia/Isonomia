'use client';
import * as React from 'react';

type PreviewReq = {
  draftMessage: { threadId: string|number; authorId: string|number; facets: any[] };
  viewAs: { userId?: string; role?: string; everyone?: boolean };
};

export function useSheafPreview() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  const preview = async (req: PreviewReq) => {
        setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sheaf/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Preview failed');
      setData(json);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, preview };
}
