"use client";
import { useMemo, useState } from "react";
import DiffSection from "@/components/briefs/DiffSection";
type Sections = {
  overview?: string;
  positions?: string;
  evidence?: string;
  openQuestions?: string;
  decision?: string;
};
export default function BriefDiffViewer({
  current,
  versions = [],
}: {
  current: { id: string; number: number; sectionsJson: Sections };
  versions: { id: string; number: number; sectionsJson: Sections }[];
}) {
  const [diffMode, setDiffMode] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const compare = useMemo(
    () => versions.find((v) => v.id === compareId) ?? null,
    [compareId, versions]
  );
  const Section = ({
    title,
    keyName,
  }: {
    title: string;
    keyName: keyof Sections;
  }) => {
    const left = compare?.sectionsJson?.[keyName] ?? "";
    const right = current.sectionsJson?.[keyName] ?? "";
    return (
        
      <section className="mb-6">
        {" "}
        <h3 className="text-sm font-semibold mb-1">{title}</h3>{" "}
        {!diffMode && <div className="prose text-sm">{right}</div>}{" "}
        {diffMode && compare && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {" "}
            <div className="rounded border border-slate-200 p-3 bg-slate-50">
              {" "}
              <div className="text-xs uppercase text-slate-500 mb-2">
                v{compare.number}
              </div>{" "}
              <DiffSection left={left} right={left} />{" "}
            </div>{" "}
            <div className="rounded border border-slate-200 p-3">
              {" "}
              <div className="text-xs uppercase text-slate-500 mb-2">
                v{current.number}
              </div>{" "}
              <DiffSection left={left} right={right} />{" "}
            </div>{" "}
          </div>
        )}{" "}
      </section>
    );
  };
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">

      {" "}
      <div className="flex items-center gap-3 mb-4">
        {" "}
        <label className="flex items-center gap-2 text-sm">
          {" "}
          <input
            type="checkbox"
            checked={diffMode}
            onChange={(e) => setDiffMode(e.target.checked)}
          />{" "}
          Diff mode{" "}
        </label>{" "}
        {diffMode && (
          <select
            className="text-sm border rounded px-2 py-1"
            value={compareId ?? ""}
            onChange={(e) => setCompareId(e.target.value || null)}
          >
            {" "}
            <option value="">Compare with…</option>{" "}
            {versions
              .filter((v) => v.id !== current.id)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {" "}
                  v{v.number}{" "}
                </option>
              ))}{" "}
          </select>
        )}{" "}
      </div>{" "}
      <Section title="Overview" keyName="overview" />{" "}
      <Section title="Positions" keyName="positions" />{" "}
      <Section title="Evidence" keyName="evidence" />{" "}
      <Section title="Open questions" keyName="openQuestions" />{" "}
      <Section title="Decision" keyName="decision" />{" "}
    </main>
  );
}
