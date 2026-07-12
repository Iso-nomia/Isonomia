// components/work/NewWorkButton.tsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

export function NewWorkButton({
  title = 'Untitled Work',
  theoryType = 'IH',
  deliberationId,
  standardOutput,
  className = '',
}: {
  title?: string;
  theoryType?: 'DN' | 'IH' | 'TC' | 'OP';
  deliberationId?: string;
  standardOutput?: string;
  className?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [href, setHref] = React.useState<string>("");

  React.useEffect(() => {
    const u = new URL('/works/new', window.location.origin);
    if (title) u.searchParams.set('title', title);
    if (theoryType) u.searchParams.set('theoryType', theoryType);
    if (deliberationId) u.searchParams.set('deliberationId', deliberationId);
    if (standardOutput) u.searchParams.set('standardOutput', standardOutput);
    setHref(u.toString());
  }, [title, theoryType, deliberationId, standardOutput]);

  const isDisabled = creating || !href;

  return (
    <button
      type="button"
      onClick={() => { if (href) { setCreating(true); router.push(href); } }}
      className="btnv2 bg-white/50 flex items-center gap-2 text-sm px-3 py-3 rounded-xl disabled:opacity-60"
      disabled={isDisabled}
      title="Compose a new model"
    >
      {creating ? <span className="kb-spinner" /> : '⨁ New Model'}
    </button>
  );
}
