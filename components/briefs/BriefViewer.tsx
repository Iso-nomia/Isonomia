// components/briefs/BriefViewer.tsx (client component)
"use client";

import { useMemo, useState } from 'react';
import DiffSection from '@/components/briefs/DiffSection';
import useSWR from 'swr';



type Sections = { overview?: string; positions?: string; evidence?: string; openQuestions?: string; decision?: string };

export default function BriefViewer({ brief }: { brief: any }) {
    
  const [expanded, setExpanded] = useState<string|null>(null);

  
    
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <section>
        <h1 className="text-2xl font-semibold">{brief.title}</h1>

        <div className="text-sm text-neutral-600 mb-4">
          Current version v{brief.currentVersion.number} ·{' '}
          {new Date(brief.currentVersion.createdAt).toLocaleString()}
        </div>
        <BriefSections version={brief.currentVersion} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Version history</h2>
        <ul className="divide-y divide-neutral-200 border rounded">
          {brief.versions?.map((v: any) => (
            <li key={v.id} className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div className="font-medium">
                  v{v.number}{' '}
                  {brief.currentVersionId === v.id && (
                    <span className="text-xs text-green-600">(current)</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(v.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="text-sm text-neutral-700 line-clamp-2">
                {v.sectionsJson?.overview || 'No overview'}
              </div>

              <button
                onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                className="text-xs text-blue-600 underline"
              >
                {expanded === v.id ? 'Hide details' : 'Show full'}
              </button>

              {expanded === v.id && (
                <div className="mt-3 border-t pt-3">
                  <BriefSections version={v} />
                </div>
              )}
            </li>
          ))
          || <li className="p-4 text-sm text-neutral-500">No version history yet.</li>}
        </ul>
      </section>
    </main>
  );


function BriefSections({ version }: { version: any }) {
  const s = version.sectionsJson as any;

  return (
    <div className="space-y-4 prose max-w-none">
      {s?.overview && <><h3 className="underline underline-offset-4">Overview</h3><p>{s.overview}</p></>}
      {s?.positions && <><h3 className="underline underline-offset-4">Positions</h3><p>{s.positions}</p></>}
      {s?.evidence && <><h3 className="underline underline-offset-4">Evidence</h3><p>{s.evidence}</p></>}
      {s?.openQuestions && <><h3 className="underline underline-offset-4">Open Questions </h3><p>{s.openQuestions}</p></>}
      {s?.decision && <><h3 className="underline underline-offset-4">Decision</h3><p>{s.decision}</p></>}
      {version.links?.length > 0 && (
        <div className="mt-2 text-sm">
          <h3 className="underline underline-offset-4">Sources</h3>
          <ul className="list-disc ml-5">
            {version.links.map((l: any) => (
              <li key={l.id}>
                {l.sourceType}: {l.sourceId}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
            }
        }
