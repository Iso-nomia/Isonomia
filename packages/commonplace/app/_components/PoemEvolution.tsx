"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { diffLines, type DiffOp } from "../../lib/line-diff";

export type PoemVersion = {
  versionNumber: number;
  changeType: string;
  changeNote: string | null;
  createdAt: string;
  lines: string[];
};

const CHANGE_LABEL: Record<string, string> = {
  CREATED: "first draft",
  REVISED: "revised",
  REFINED: "refined",
  CORRECTED: "corrected",
  RECLASSIFIED: "reclassified",
};

/**
 * In-place evolution view for poems. Toggles on the entry page. Shows, newest
 * first, a collapsible line-level diff for every committed revision, plus a
 * compare-any-two panel. `versions` arrive newest-first. Removed/old lines can
 * be cherry-picked back into the working draft via `entryId`.
 */
export default function PoemEvolution({
  entryId,
  versions,
}: {
  entryId: string;
  versions: PoemVersion[];
}) {
  const [open, setOpen] = useState(false);

  // Cherry-pick state: how many lines were restored this session, plus the
  // most recent restored text (for the confirmation message).
  const [restoredCount, setRestoredCount] = useState(0);
  const [lastRestored, setLastRestored] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoringText, setRestoringText] = useState<string | null>(null);

  async function restoreLine(text: string) {
    if (!text.trim() || restoringText) return;
    setRestoringText(text);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/entries/${entryId}/restore-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "restore_failed");
      }
      setRestoredCount((c) => c + 1);
      setLastRestored(text);
    } catch (e) {
      setRestoreError((e as Error).message);
    } finally {
      setRestoringText(null);
    }
  }

  // Ascending copy for adjacent-pair diffs and the compare selectors.
  const ascending = useMemo(
    () => [...versions].sort((a, b) => a.versionNumber - b.versionNumber),
    [versions],
  );

  const oldest = ascending[0]?.versionNumber ?? 1;
  const latest = ascending[ascending.length - 1]?.versionNumber ?? oldest;

  const [baseNum, setBaseNum] = useState<number>(oldest);
  const [compareNum, setCompareNum] = useState<number>(latest);

  if (versions.length < 2) return null;

  const byNumber = new Map(ascending.map((v) => [v.versionNumber, v]));
  const base = byNumber.get(baseNum);
  const compare = byNumber.get(compareNum);
  const compareDiff =
    base && compare ? diffLines(base.lines, compare.lines) : null;

  return (
    <section className="border-t border-stone-500 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-[16px] font-medium text-stone-700">
          Evolution
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-sans text-sm text-stone-700 hover:text-stone-900 hover:underline"
        >
          {open ? "Hide" : `Show ${versions.length} revisions`}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-8">
          {(restoredCount > 0 || restoreError) && (
            <div className="rounded border border-emerald-200 bg-emerald-50/70 px-3 py-2 font-sans text-xs">
              {restoreError ? (
                <span className="text-rose-700">
                  Could not restore line: {restoreError}
                </span>
              ) : (
                <span className="text-emerald-800">
                  Restored {restoredCount} line{restoredCount === 1 ? "" : "s"} to
                  the end of your working draft
                  {lastRestored ? ` (“${truncate(lastRestored)}”)` : ""}.{" "}
                  <Link
                    href={`/entry/${entryId}/edit`}
                    className="font-medium underline hover:text-emerald-900"
                  >
                    Open editor to reposition &amp; commit
                  </Link>
                </span>
              )}
            </div>
          )}

          {/* Compare any two */}
          <div className="space-y-3 rounded border border-stone-500 bg-stone-50/60 p-4">
            <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-stone-600">
              <span>Compare</span>
              <VersionSelect
                value={baseNum}
                options={ascending}
                onChange={setBaseNum}
              />
              <span>→</span>
              <VersionSelect
                value={compareNum}
                options={ascending}
                onChange={setCompareNum}
              />
              {compareDiff && (
                <span className="text-stone-400">
                  {compareDiff.identical
                    ? "· identical"
                    : `· +${compareDiff.added} −${compareDiff.removed}`}
                </span>
              )}
            </div>
            {compareDiff && (
              <DiffBlock
                ops={compareDiff.ops}
                onRestore={restoreLine}
                restoringText={restoringText}
              />
            )}
          </div>

          {/* Newest-first stack of adjacent diffs. */}
          <ol className="space-y-3">
            {ascending
              .map((v, i) => ({ v, prev: i > 0 ? ascending[i - 1] : null }))
              .reverse()
              .map(({ v, prev }) => (
                <li key={v.versionNumber}>
                  <RevisionRow
                    version={v}
                    previous={prev}
                    onRestore={restoreLine}
                    restoringText={restoringText}
                  />
                </li>
              ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function truncate(s: string, max = 48) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function VersionSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: PoemVersion[];
  onChange: (n: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded border border-stone-300 bg-white px-2 py-1 font-mono text-xs text-stone-700"
    >
      {options.map((o) => (
        <option key={o.versionNumber} value={o.versionNumber}>
          v{o.versionNumber}
        </option>
      ))}
    </select>
  );
}

function RevisionRow({
  version,
  previous,
  onRestore,
  restoringText,
}: {
  version: PoemVersion;
  previous: PoemVersion | null;
  onRestore: (text: string) => void;
  restoringText: string | null;
}) {
  const diff = previous ? diffLines(previous.lines, version.lines) : null;
  const label = CHANGE_LABEL[version.changeType] ?? version.changeType.toLowerCase();
  const date = new Date(version.createdAt).toLocaleDateString();

  return (
    <details className="group rounded border border-stone-500" open={!previous}>
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-2 px-3 py-2 font-sans text-xs text-stone-600 marker:content-['']">
        <span className="font-mono text-stone-700">v{version.versionNumber}</span>
        <span className="uppercase tracking-wide text-stone-500">{label}</span>
        <time className="text-stone-400">{date}</time>
        {diff && !diff.identical && (
          <span className="text-stone-400">
            +{diff.added} −{diff.removed}
          </span>
        )}
        {version.changeNote && (
          <span className="text-stone-600">— {version.changeNote}</span>
        )}
        <span className="ml-auto text-stone-400 group-open:hidden">▸</span>
        <span className="ml-auto hidden text-stone-400 group-open:inline">▾</span>
      </summary>
      <div className="border-t border-stone-100 px-3 py-3">
        {diff ? (
          <DiffBlock
            ops={diff.ops}
            onRestore={onRestore}
            restoringText={restoringText}
          />
        ) : (
          <PoemBlock
            lines={version.lines}
            onRestore={onRestore}
            restoringText={restoringText}
          />
        )}
      </div>
    </details>
  );
}

function DiffBlock({
  ops,
  onRestore,
  restoringText,
}: {
  ops: DiffOp[];
  onRestore: (text: string) => void;
  restoringText: string | null;
}) {
  return (
    <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
      {ops.map((op, i) => {
        if (op.text === "" && op.type === "equal") {
          return <div key={i} className="h-3" aria-hidden />;
        }
        const cls =
          op.type === "add"
            ? "bg-emerald-50 text-emerald-900"
            : op.type === "remove"
              ? "bg-rose-50 text-rose-900 line-through decoration-rose-300"
              : "text-stone-700";
        const prefix = op.type === "add" ? "+ " : op.type === "remove" ? "− " : "  ";
        return (
          <div key={i} className={`group/line flex items-baseline gap-2 ${cls}`}>
            <span className="flex-1">
              <span className="select-none text-stone-400">{prefix}</span>
              {op.text || "\u00A0"}
            </span>
            {op.type === "remove" && op.text.trim() !== "" && (
              <RestoreButton
                text={op.text}
                onRestore={onRestore}
                restoringText={restoringText}
              />
            )}
          </div>
        );
      })}
    </pre>
  );
}

function PoemBlock({
  lines,
  onRestore,
  restoringText,
}: {
  lines: string[];
  onRestore: (text: string) => void;
  restoringText: string | null;
}) {
  return (
    <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-stone-700">
      {lines.map((line, i) =>
        line === "" ? (
          <div key={i} className="h-3" aria-hidden />
        ) : (
          <div key={i} className="group/line flex items-baseline gap-2">
            <span className="flex-1">{line}</span>
            <RestoreButton
              text={line}
              onRestore={onRestore}
              restoringText={restoringText}
            />
          </div>
        ),
      )}
    </pre>
  );
}

function RestoreButton({
  text,
  onRestore,
  restoringText,
}: {
  text: string;
  onRestore: (text: string) => void;
  restoringText: string | null;
}) {
  const busy = restoringText === text;
  return (
    <button
      type="button"
      onClick={() => onRestore(text)}
      disabled={restoringText !== null}
      title="Restore this line to the working draft"
      className="shrink-0 rounded border border-stone-300 bg-white px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wide text-stone-500 opacity-0 transition hover:border-stone-500 hover:text-stone-800 focus:opacity-100 group-hover/line:opacity-100 disabled:opacity-40"
    >
      {busy ? "…" : "↩ restore"}
    </button>
  );
}
