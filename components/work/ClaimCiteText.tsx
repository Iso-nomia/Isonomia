// components/work/ClaimCiteText.tsx
'use client';
import * as React from 'react';

export function ClaimCiteText({ text }:{ text:string }) {
  const html = React.useMemo(() => {
    return text.replace(/\[\[claim:([a-zA-Z0-9_-]{6,})\]\]/g, (_m, id) =>
      `<a href="/claims/${id}" class="underline" data-claim-id="${id}">[claim:${id}]</a>`);
  }, [text]);
  return <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
