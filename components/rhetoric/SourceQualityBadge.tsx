// components/rhetoric/SourceQualityBadge.tsx
'use client';
import * as React from 'react';
import { classifySource } from '@/lib/rhetoric/sourceQuality';

export function SourceQualityBadge({ text }: { text: string }) {
  const urls = React.useMemo(() => {
    const rx = /\bhttps?:\/\/[^\s)]+/g;
    return Array.from(text.match(rx) || []).slice(0, 3); // first few
  }, [text]);

  if (!urls.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {urls.map((u, i) => {
        const g = classifySource(u, text);
        const label =
          g.cls === 'peerreview' ? 'Peer‑reviewed' :
          g.cls === 'preprint'   ? 'Preprint' :
          g.cls === 'gov'        ? 'Gov' :
          g.cls === 'edu'        ? 'Edu' :
          g.cls === 'news_t1'    ? 'Tier‑1 news' :
          g.cls === 'news_t2'    ? 'News' :
          g.cls === 'blog_forum' ? 'Blog/Forum' : 'Source';
        const pct = Math.round(g.score*100);
        return (
          <span key={i} className="px-1.5 py-0.5 rounded border text-[10px] bg-neutral-50">
            {label} {pct}%
          </span>
        );
      })}
    </div>
  );
}
