import { ExternalLink, Archive } from "lucide-react";
import type { EvidenceVM } from "@/lib/citations/argumentDialectic";

/**
 * Shared evidence-source link card. Renders a citation's title, description,
 * and URL identically wherever sources appear — premise evidence, conclusion
 * evidence, and (via the dialectical layer) attack / response evidence — so
 * the whole page cites sources with one visual grammar.
 *
 * Server-safe (no client interactivity).
 */
export default function EvidenceCard({ evidence }: { evidence: EvidenceVM }) {
  return (
    <a
      href={evidence.uri}
      target="_blank"
      rel="noopener noreferrer"
      className="group block px-3 py-2 bg-white hover:bg-sky-50/40 border border-slate-300 hover:border-sky-400 rounded-md min-w-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] font-semibold text-slate-800 group-hover:text-sky-700 leading-snug break-words flex-1">
          {evidence.title || evidence.uri}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {evidence.archived && (
            <span
              title="Archived snapshot on file"
              className="text-emerald-500"
            >
              <Archive className="w-3 h-3" />
            </span>
          )}
          <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-sky-500 transition-colors" />
        </div>
      </div>
      {evidence.citation && (
        <div className="text-[11px] text-slate-600 leading-relaxed mt-1 break-words">
          {evidence.citation}
        </div>
      )}
      <div className="text-[10px] text-sky-600/80 font-mono truncate mt-0.5">
        {evidence.uri}
      </div>
    </a>
  );
}
