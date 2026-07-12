'use client';
import * as React from 'react';

export type AudienceSelector =
  | { kind: 'EVERYONE' }
  | { kind: 'ROLE'; role: string; mode: 'DYNAMIC' }
  | { kind: 'LIST'; listId: string; mode: 'DYNAMIC' | 'SNAPSHOT' }
  | { kind: 'USERS'; mode: 'SNAPSHOT' | 'DYNAMIC'; userIds?: string[]; snapshotMemberIds?: string[] };

  export type UIAttachment = {
    name: string;
    mime: string;
    size: number;
    sha256: string;
    path?: string | null;
    file?: File; // local only
  };

export type FacetDraft = {
  id: string;                // local id
  audience: AudienceSelector;
  policy: 'ALLOW'|'REDACT'|'FORBID';
  expiresAt?: number | null;
  body: any;                 // your TipTap JSON
  attachments?: UIAttachment[];
};

export function FacetChipBar({
  facets, onChange, onAddFacet, onRemoveFacet, activeIndex, onActiveIndex,
}: {
  facets: FacetDraft[];
  onChange: (next: FacetDraft[]) => void;
  onAddFacet: (audience: AudienceSelector) => void;
  onRemoveFacet: (idx: number) => void;
  activeIndex: number;
  onActiveIndex: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {facets.map((f, i) => {
        const label =
          f.audience.kind === 'EVERYONE' ? 'Everyone' :
          f.audience.kind === 'ROLE' ? `Role:${f.audience.role}` :
          f.audience.kind === 'LIST' ? f.audience.listId :
          'Direct';
        return (
          <button
            type="button"
            key={f.id}
            className={`px-2 py-1 rounded-full text-xs ${i===activeIndex ? 'bg-black text-white' : 'bg-white/70'}`}
            onClick={() => onActiveIndex(i)}
          >
            {label}
          </button>
        );
      })}
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <button type="button" className="px-2 py-1 rounded bg-white/70 text-xs" onClick={() => onAddFacet({ kind: 'EVERYONE' })}>+ Everyone</button>
        <button type="button" className="px-2 py-1 rounded bg-white/70 text-xs" onClick={() => onAddFacet({ kind: 'LIST', listId: 'core_team', mode: 'SNAPSHOT' })}>+ Core</button>
        <button type="button" className="px-2 py-1 rounded bg-white/70 text-xs" onClick={() => onAddFacet({ kind: 'ROLE', role: 'MOD', mode: 'DYNAMIC' })}>+ Mod</button>
      </div>
    </div>
  );
}
