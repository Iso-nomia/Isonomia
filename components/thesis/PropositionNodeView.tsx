"use client";

import { useEffect, useState } from "react";
import { Link as LinkIcon } from "lucide-react";

interface Citation {
  id: string;
  url: string | null;
  title: string | null;
  text: string | null;
  locator: string | null;
  note: string | null;
  createdAt: string;
}

interface PropositionNodeViewProps {
  propositionId: string;
  propositionText: string;
  mediaUrl?: string | null;
  authorName?: string | null;
}

export function PropositionNodeView({
  propositionId,
  propositionText,
  mediaUrl,
  authorName,
}: PropositionNodeViewProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loadingCitations, setLoadingCitations] = useState(false);

  useEffect(() => {
    if (!propositionId) return;

    setLoadingCitations(true);
    fetch(`/api/propositions/${propositionId}/citations`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.citations) {
          setCitations(data.citations);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch citations:", err);
      })
      .finally(() => {
        setLoadingCitations(false);
      });
  }, [propositionId]);

  return (
    <div className="not-prose my-2 py-3 px-2 space-y-1 border-l-4 rounded-r-lg border-purple-300 bg-purple-100 text-purple-900">
      <div className="flex items-start justify-between tracking-wide">
        <div className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Proposition
        </div>
        {citations.length > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
            <LinkIcon className="w-3 h-3" />
            {citations.length} {citations.length === 1 ? "citation" : "citations"}
          </span>
        )}
      </div>
      <p className="text-base leading-relaxed">{propositionText}</p>
      {mediaUrl && (
        <div className="mt-3">
          <img
            src={mediaUrl}
            alt="Proposition media"
            className="max-w-md rounded-lg border border-slate-200"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      {citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-purple-200">
          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">
            Citations
          </div>
          <div className="space-y-2">
            {citations.map((citation) => (
              <div key={citation.id} className="text-sm">
                {citation.url ? (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                  >
                    <LinkIcon className="w-3 h-3 flex-shrink-0" />
                    <span>{citation.title || citation.url}</span>
                  </a>
                ) : (
                  <span className="text-purple-800">
                    {citation.title || citation.text}
                  </span>
                )}
                {citation.locator && (
                  <span className="text-xs text-purple-600 ml-1">
                    ({citation.locator})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {authorName && <p className="mt-2 text-xs opacity-60">— {authorName}</p>}
    </div>
  );
}
