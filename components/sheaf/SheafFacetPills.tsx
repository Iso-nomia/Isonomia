"use client";
import clsx from "clsx";

export function SheafFacetPills({
  facets,
  activeId,
  onSelect,
}: {
  facets: { id: string; audience: { kind: string; role?: string } }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1 text-[11px] text-slate-600">
      {facets.map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => onSelect(f.id)}
          className={clsx(
            "px-2 py-0.5 rounded-full border transition",
            activeId === f.id ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
        >
          {label(f.audience)}
        </button>
      ))}
    </div>
  );
}

function label(a: { kind: string; role?: string }) {
  switch (a.kind) {
    case "EVERYONE": return "Public";
    case "ROLE": return `Role: ${a.role}`;
    case "LIST": return "List";
    case "USERS": return "Specific";
    default: return a.kind;
  }
}
