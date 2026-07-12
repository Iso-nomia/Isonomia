// components/claims/ClaimDetail.tsx
"use client";

import { useRouter } from 'next/navigation';

// ✅ Define types for the new, richer data
type Citation = {
  id: string;
  sourceName: string | null;
  url: string | null;
  comment: string | null;
};

type CanonicalClaim = {
  id: string;
  text: string;
} | null; // It can be null

// ✅ Update the component's props to accept the new data
type ClaimDetailProps = {
  id: string;
  text: string;
  moid: string;
  createdAt: Date;
  backHref?: string;
  citations: Citation[];
  canonical: CanonicalClaim;
};

export default function ClaimDetail({ 
  id, text, moid, createdAt, backHref, citations, canonical 
}: ClaimDetailProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };
  
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-4">
        <button 
          onClick={handleBack}
          className="px-3 py-1 text-xs rounded-md border border-slate-300 bg-white hover:bg-slate-50"
        >
          ← Back
        </button>
      </div>

      {/* ✅ NEW: Canonical Claim Notice */}
      {canonical && (
        <div className="bg-sky-50 border-l-4 border-sky-400 text-sky-800 p-4 rounded-md mb-6" role="alert">
          <p className="font-bold text-sm">Canonical Version</p>
          <p className="text-sm mt-1">
            This is a variation of a canonical claim. View the original: {' '}
            <a href={`/claim/${canonical.id}`} className="underline hover:no-underline font-semibold">
              "{canonical.text}"
            </a>
          </p>
        </div>
      )}

      <div className="bg-white shadow-lg rounded-xl p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Claim Text</h2>
          <blockquote className="text-xl text-gray-900 mt-1 border-l-4 border-sky-500 pl-4 italic">
            {text}
          </blockquote>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* ... (id, moid, createdAt fields remain the same) ... */}
            <div className="bg-gray-50 p-3 rounded-md">
                <h3 className="font-semibold text-gray-600">Claim ID</h3>
                <p className="font-mono text-gray-800 break-all">{id}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
                <h3 className="font-semibold text-gray-600">MOID</h3>
                <p className="font-mono text-gray-800 break-all">{moid}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md col-span-1 md:col-span-2">
                <h3 className="font-semibold text-gray-600">Created At</h3>
                <p className="text-gray-800">{new Date(createdAt).toLocaleString()}</p>
            </div>
        </div>
      </div>
      
      {/* ✅ NEW: Citations Section */}
      {citations && citations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
            Citations
          </h2>
          <ul className="space-y-4">
            {citations.map((citation) => (
              <li key={citation.id} className="bg-white shadow-md rounded-lg p-4">
                <div className="font-semibold text-gray-800">{citation.sourceName || 'Untitled Source'}</div>
                {citation.url && (
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:underline break-all">
                    {citation.url}
                  </a>
                )}
                {citation.comment && (
                  <p className="text-sm text-gray-600 mt-2 italic">&quot;{citation.comment}&quot;</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}