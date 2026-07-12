'use client';

import * as React from 'react';
import type { AudienceSelector } from '@app/sheaf-acl';

export function AudiencePicker(props: {
  value: AudienceSelector;
  onChange: (a: AudienceSelector) => void;
  authorId: string | number;
  conversationId: string | number;
}) {
  const { value, onChange, authorId, conversationId } = props;
  const [kind, setKind] = React.useState<AudienceSelector['kind']>(value.kind);
  const [role, setRole] = React.useState(value.kind === 'ROLE' ? value.role : 'MOD');
  const [lists, setLists] = React.useState<{ id: string; name: string }[]>([]);
  const [listId, setListId] = React.useState(
    value.kind === 'LIST' ? value.listId : ''
  );
  const [mode, setMode] = React.useState<'DYNAMIC' | 'SNAPSHOT'>(
    value.kind === 'LIST' || value.kind === 'USERS' ? value.mode : 'SNAPSHOT'
  );
  const [people, setPeople] = React.useState<{ id: string; name: string }[]>(
    []
  );
  const [userIds, setUserIds] = React.useState<string[]>(
    value.kind === 'USERS' ? (value.userIds ?? []) : []
  );

  // load lists for author
  React.useEffect(() => {
    fetch(`/api/sheaf/lists?ownerId=${authorId}`)
      .then((r) => r.ok ? r.json() : { lists: [] })
      .then((d) => setLists(d.lists ?? []))
      .catch(() => {});
  }, [authorId]);

  // load participants for users picker
  React.useEffect(() => {
    fetch(`/api/sheaf/participants?conversationId=${conversationId}`)
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((d) =>
            setPeople((d.users ?? []).map((u: any) => ({
              id: String(u.id),
              name: u.name ?? "User",
            })))
          )
      .catch(() => {});
  }, [conversationId]);

  React.useEffect(() => {
    switch (kind) {
      case 'EVERYONE':
        onChange({ kind: 'EVERYONE' });
        break;
      case 'ROLE':
        onChange({ kind: 'ROLE', role, mode: 'DYNAMIC' });
        break;
      case 'LIST':
        onChange({ kind: 'LIST', listId, mode });
        break;
      case 'USERS':
        onChange({ kind: 'USERS', mode, userIds });
        break;
    }
  }, [kind, role, listId, mode, userIds, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <select
                               className="text-xs lockbutton rounded-xl px-2 py-1 bg-white/70"

        value={kind}
        onChange={(e) => setKind(e.target.value as any)}
      >
        <option value="EVERYONE">Everyone</option>
        <option value="ROLE">Role</option>
        <option value="LIST">List</option>
        <option value="USERS">Specific people</option>
      </select>

      {kind === 'ROLE' && (
        <select
        className="text-xs lockbutton rounded-xl px-2 py-1 bg-white/70"
        value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="MOD">MOD</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      )}

      {kind === 'LIST' && (
        <>
          <select
                               className="text-xs lockbutton rounded-xl px-2 py-1 bg-white/70"
                               value={listId}
            onChange={(e) => setListId(e.target.value)}
          >
            <option value="">— choose list —</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select
                               className="text-xs lockbutton rounded-xl px-2 py-1 bg-white/70"
                               value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            title="Snapshot = freeze membership at send time"
          >
            <option value="SNAPSHOT">Snapshot</option>
            <option value="DYNAMIC">Dynamic</option>
          </select>
        </>
      )}

      {kind === 'USERS' && (
        <>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-md border bg-white/70 px-2 py-2">
      {people.map((p) => {
        const checked = userIds.includes(p.id);
        return (
          <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={checked}
              onChange={(e) =>
                setUserIds((prev) =>
                  e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                )
              }
            />
            <span className="truncate">{p.name}</span>
          </label>
        );
      })}
    </div>
          <select
                               className="text-xs lockbutton rounded-xl px-2 py-1 bg-white/70"
                               value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="SNAPSHOT">Snapshot</option>
            <option value="DYNAMIC">Dynamic</option>
          </select>
        </>
      )}
    </div>
  );
}
