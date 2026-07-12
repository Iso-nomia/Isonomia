"use client";

// Moderator picker (docs/DELIBERATION_CREATION_DEV_SPEC.md §4.3).
//
// Searches users via `/api/users/search` (returns `{ id, name, username, image }`
// with the internal stringified `User.id` — the key the `create` API expects for
// `moderatorIds`). Selected users render as removable chips; `onChange` reports
// the current id list.

import * as React from "react";

export type PickedUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

function userLabel(u: PickedUser): string {
  return u.name || (u.username ? `@${u.username}` : u.id);
}

export default function ModeratorPicker({
  value,
  onChange,
}: {
  value: PickedUser[];
  onChange: (next: PickedUser[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PickedUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const selectedIds = React.useMemo(() => new Set(value.map((u) => u.id)), [value]);

  // Debounced search.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data: PickedUser[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch (err: any) {
        if (err?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  function add(u: PickedUser) {
    if (!selectedIds.has(u.id)) onChange([...value, u]);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function remove(id: string) {
    onChange(value.filter((u) => u.id !== id));
  }

  const visibleResults = results.filter((u) => !selectedIds.has(u.id));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-sm"
            >
              {u.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.image}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] rounded-full object-cover"
                />
              )}
              <span>{userLabel(u)}</span>
              <button
                type="button"
                onClick={() => remove(u.id)}
                aria-label={`Remove ${userLabel(u)}`}
                className="text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => visibleResults.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search people by name or @username…"
          className="w-full articlesearchfield rounded-md border border-indigo-200 px-3 py-2 text-dark-2 placeholder:text-dark-1"
        />
        {open && (loading || visibleResults.length > 0) && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow-lg">
            {loading && (
              <li className="px-3 py-2 text-sm text-gray-400">Searching…</li>
            )}
            {!loading &&
              visibleResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    // onMouseDown (not onClick) so it fires before the input blur.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(u);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {u.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.image}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    )}
                    <span className="font-medium text-dark-1">{userLabel(u)}</span>
                    {u.username && (
                      <span className="text-xs text-gray-400">@{u.username}</span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
