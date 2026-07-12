
'use client';

import * as React from 'react';
import useSWRInfinite from 'swr/infinite';
import { Virtuoso } from 'react-virtuoso';
import { BookOpen, CheckOctagon, PlusHexagon } from "@mynaui/icons-react";
import { Send, Share,EnvelopeOpen, TrendingUp, CheckSquare } from "@mynaui/icons-react";
import { GlossaryText } from '@/components/glossary/GlossaryText';


import { 
  ArrowUp, 
  ArrowDown, 
  Star, 
  MessageSquare, 
  Link2, 
  CheckCircle2,
  ChevronDown,
  Search,
  Filter,
  Sparkles,
  SendHorizontal,
  SquareCheck,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';

const PAGE = 20;
const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(async r => {
  const j = await r.json().catch(()=>({}));
  if (!r.ok || (j && j.ok === false)) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
});

type PropositionRow = {
  id: string;
  deliberationId: string;
  authorId: string;
  text: string;
  mediaType: 'text' | 'image' | 'video' | 'audio' | null;
  mediaUrl?: string | null;
  status: 'DRAFT'|'PUBLISHED'|'CLAIMED'|'ARCHIVED';
  promotedClaimId?: string | null;
  voteUpCount: number;
  voteDownCount: number;
  endorseCount: number;
  replyCount: number;
  createdAt: string;
};



// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(192, 194, 222, 0.4);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(218, 228, 239, 0.6);
  }
`;


// Enhanced metric badge with icon
function MetricBadge({ 
  icon: Icon, 
  count, 
  tone = 'neutral',
  active = false 
}: { 
  icon: any; 
  count: number; 
  tone?: 'up'|'down'|'endorse'|'replies'|'neutral'; 
  active?: boolean;
}) {
  const colors = {
    up: active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    down: active ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-rose-50 text-rose-600 border-rose-100',
    replies: active ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
    endorse: active ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-sky-50 text-sky-600 border-sky-100',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200'
  };

  return (
    <div className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium
      transition-all duration-200
      ${colors[tone]}
      ${active ? 'shadow-sm' : ''}
    `}>
      <Icon className="w-3 h-3" />
      <span>{count}</span>
    </div>
  );
}

// Enhanced text clamping with smooth expansion
function ClampedText({ text, lines = 4 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const [shouldClamp, setShouldClamp] = React.useState(false);

  React.useEffect(() => {
    if (ref.current) {
      const lineHeight = parseInt(getComputedStyle(ref.current).lineHeight);
      const maxHeight = lineHeight * lines;
      setShouldClamp(ref.current.scrollHeight > maxHeight);
    }
  }, [text, lines]);

  return (
    <div className="relative">
      <div 
        ref={ref}
        className={`
          text-sm leading-relaxed text-slate-700 whitespace-pre-wrap
          transition-all duration-300 ease-in-out
          ${expanded ? '' : `line-clamp-${lines}`}
        `}
      >
        <GlossaryText text={text} />
      </div>
      {shouldClamp && !expanded && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
          <button 
            onClick={() => setExpanded(true)}
            className="
              absolute bottom-0 right-0 px-3 py-1 text-xs font-medium
              bg-white border border-slate-200 rounded-full
              text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50
              transition-all duration-200 shadow-sm hover:shadow
              flex items-center gap-1
            "
          >
            Read more
            <ChevronDown className="w-3 h-3" />
          </button>
        </>
      )}
      {expanded && (
        <button 
          onClick={() => setExpanded(false)}
          className="
            mt-2 px-3 py-1 text-xs font-medium
            text-slate-600 hover:text-slate-700
            transition-colors duration-200
          "
        >
          Show less
        </button>
      )}
    </div>
  );
}

function RepliesModal({ 
  propositionId, 
  onClose 
}: { 
  propositionId: string; 
  onClose: () => void;
}) {
  const [replies, setReplies] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [authors, setAuthors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch replies with pagination
        const r = await fetch(`/api/propositions/${encodeURIComponent(propositionId)}/replies?limit=100`, {
          cache: "no-store"
        });
        const j = await r.json();
        
        if (!r.ok) {
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        
        if (!cancel) {
          const items = j.items || [];
          setReplies(items);
          
          // Fetch author names for unique authorIds
          const uniqueAuthorIds = [...new Set(items.map((item: any) => item.authorId as string))] as string[];
          const authorMap: Record<string, string> = {};
          
          await Promise.all(
            uniqueAuthorIds.map(async (authorId: string) => {
              try {
                const userRes = await fetch(`/api/users/${encodeURIComponent(authorId)}`, {
                  cache: "no-store"
                });
                const userData = await userRes.json();
                if (userRes.ok && userData?.user) {
                  authorMap[authorId] = userData.user.name || userData.user.username || "Anonymous";
                }
              } catch {
                authorMap[authorId] = "Anonymous";
              }
            })
          );
          
          if (!cancel) {
            setAuthors(authorMap);
          }
        }
      } catch (err) {
        if (!cancel) {
          setError(err instanceof Error ? err.message : "Failed to load replies");
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    })();
    return () => { cancel = true; };
  }, [propositionId]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Replies</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200"
            title="Close"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {!loading && !error && replies.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm text-slate-600">No replies yet</p>
            </div>
          )}

          {!loading && !error && replies.length > 0 && (
            <div className="space-y-4">
              {replies.map((reply) => (
                <div 
                  key={reply.id} 
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                    <span className="font-medium">{authors[reply.authorId] || "Anonymous"}</span>
                    <span>•</span>
                    <time>
                      {new Date(reply.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </time>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced promote button with better states
function PromoteButton({ 
  deliberationId, 
  id, 
  text, 
  onPromoted 
}: {
  deliberationId: string; 
  id: string; 
  text: string; 
  onPromoted: (claimId: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  
  return (
          <button className="   text-center  px-5 py-2 text-[12.5px] tracking-wide btnv2 font-medium rounded-full"

      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const r = await fetch(`/api/propositions/${encodeURIComponent(id)}/promote`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ deliberationId, text })
          });
          const j = await r.json();
          if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
          onPromoted(j.claimId);
          window.dispatchEvent(new CustomEvent('claims:changed', { detail: { deliberationId } }));
          window.dispatchEvent(new CustomEvent('dialogue:moves:refresh', { detail: { deliberationId } }));
        } finally { 
          setBusy(false); 
        }
      }}
    >
      {busy ? (
        <>
                            <PlusHexagon className="w-4 h-4 animate-pulse" />

          <span>Promote...</span>

        </>
      ) : (
        <>
                            <PlusHexagon className="w-4 h-4" />

          <span>Promote to Claim</span>

        </>
      )}
    </button>
  );
}

// Enhanced proposition row
function Row({ 
  p, 
  deliberationId, 
  onRefresh 
}: {
  p: PropositionRow;
  deliberationId: string;
  onRefresh: () => void;
}) {
  const [viewerVote, setViewerVote] = React.useState<number>(0);
  const [viewerEnd, setViewerEnd] = React.useState<boolean>(false);
  const [counts, setCounts] = React.useState<{
    up: number; 
    down: number; 
    endorse: number; 
    replies: number;
  }>({
    up: p.voteUpCount, 
    down: p.voteDownCount, 
    endorse: p.endorseCount, 
    replies: p.replyCount
  });
  const [openReply, setOpenReply] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');
  const [showCopied, setShowCopied] = React.useState(false);
  const [showRepliesModal, setShowRepliesModal] = React.useState(false);
  const [citations, setCitations] = React.useState<any[]>([]);
  const [loadingCitations, setLoadingCitations] = React.useState(false);

  // Hydrate viewer state
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      const r = await fetch(`/api/propositions/${encodeURIComponent(p.id)}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!cancel && j?.proposition) {
        setViewerVote(j.proposition.viewerVote ?? 0);
        setViewerEnd(!!j.proposition.viewerEndorsed);
      }
    })();
    return () => { cancel = true; };
  }, [p.id]);

  // Fetch citations
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingCitations(true);
      try {
        const r = await fetch(`/api/propositions/${encodeURIComponent(p.id)}/citations`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!cancel && j?.ok && j?.citations) {
          setCitations(j.citations);
        }
      } catch {
        // Silent fail - citations not critical
      } finally {
        if (!cancel) setLoadingCitations(false);
      }
    })();
    return () => { cancel = true; };
  }, [p.id]);

  async function vote(newVote: -1 | 0 | 1) {
    const prev = viewerVote;
    const upDelta = (newVote === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
    const downDelta = (newVote === -1 ? 1 : 0) - (prev === -1 ? 1 : 0);
    
    setViewerVote(newVote);
    setCounts(c => ({ ...c, up: c.up + upDelta, down: c.down + downDelta }));
    
    try {
      const r = await fetch(`/api/propositions/${encodeURIComponent(p.id)}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: newVote })
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
      
      setCounts({ 
        up: j.voteUpCount, 
        down: j.voteDownCount, 
        endorse: counts.endorse, 
        replies: counts.replies 
      });
      setViewerVote(j.viewerVote);
    } catch {
      setViewerVote(prev);
      setCounts(c => ({ ...c, up: c.up - upDelta, down: c.down - downDelta }));
    }
  }

  async function endorse() {
    const desired = !viewerEnd;
    setViewerEnd(desired);
    setCounts(c => ({ ...c, endorse: c.endorse + (desired ? 1 : -1) }));
    
    try {
      const r = await fetch(`/api/propositions/${encodeURIComponent(p.id)}/endorse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ on: desired })
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
      
      setViewerEnd(j.endorsed);
      setCounts(c => ({ ...c, endorse: j.endorseCount }));
    } catch {
      setViewerEnd(!desired);
      setCounts(c => ({ ...c, endorse: c.endorse + (desired ? -1 : 1) }));
    }
  }

  async function postReply() {
    const t = replyText.trim();
    if (!t) return;
    
    setReplyText('');
    setOpenReply(false);
    setCounts(c => ({ ...c, replies: c.replies + 1 }));
    
    try {
      const r = await fetch(`/api/propositions/${encodeURIComponent(p.id)}/replies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: t })
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
    } catch {
      setCounts(c => ({ ...c, replies: c.replies - 1 }));
    }
  }

  const openReplies = () => {
    setShowRepliesModal(true);
  };
  const closeReplies = async () => {
    setShowRepliesModal(false);
    
    // Refresh proposition data to get updated reply count
    try {
      const r = await fetch(`/api/propositions/${encodeURIComponent(p.id)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.proposition) {
        setCounts(c => ({ ...c, replies: j.proposition.replyCount }));
      }
    } catch {}
  };

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#prop-${p.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }).catch(() => {});
  };

  const created = new Date(p.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const netScore = counts.up - counts.down;

  return (
    <>
    <article className="
      group relative
      px-4 py-5  about-flow-lite rounded-xl mt-2 mx-2 
     
    ">
      {/* Status indicator bar */}
      {p.status === 'CLAIMED' && (
        <div className="absolute rounded-xl left-0 top-6 bottom-6 w-[1.5px] bg-gradient-to-b from-emerald-400 to-emerald-600" />
      )}

      <div className="flex  gap-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            onClick={() => vote(viewerVote === 1 ? 0 : 1)}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${viewerVote === 1 
                ? 'bg-emerald-100 text-emerald-700 shadow-sm' 
                : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
              }
              hover:scale-110 active:scale-95
            `}
            title="Upvote"
          >
            <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
          </button>
          
          <span className={`
            text-sm font-bold tabular-nums min-w-[2ch] text-center
            transition-colors duration-200
            ${netScore > 0 ? 'text-emerald-600' : netScore < 0 ? 'text-rose-600' : 'text-slate-500'}
          `}>
            {netScore > 0 ? '+' : ''}{netScore}
          </span>
          
          <button
            onClick={() => vote(viewerVote === -1 ? 0 : -1)}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${viewerVote === -1 
                ? 'bg-rose-100 text-rose-700 shadow-sm' 
                : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
              }
              hover:scale-110 active:scale-95
            `}
            title="Downvote"
          >
            <ArrowDown className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <time className="font-medium">{created}</time>
              {p.status === 'CLAIMED' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Claim
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              <MetricBadge icon={SquareCheck} count={counts.endorse} tone="endorse" active={viewerEnd} />
              <MetricBadge icon={MessageSquare} count={counts.replies} tone="replies" />
              {p.mediaUrl && (
                <MetricBadge icon={ImageIcon} count={1} tone="neutral" />
              )}
              {citations.length > 0 && (
                <MetricBadge icon={LinkIcon} count={citations.length} tone="neutral" />
              )}
            </div>
          </div>

          {/* Main text content */}
          <div className="mb-4 p-4 bg-gradient-to-br from-slate-50/50 to-white/50 backdrop-blur-md rounded-xl border border-slate-200">
            <ClampedText text={p.text} lines={4} />
            
            {/* Media display */}
            {p.mediaUrl && p.mediaType === 'image' && (
              <div className="mt-3">
                <img 
                  src={p.mediaUrl} 
                  alt="Proposition media" 
                  className="max-w-full h-auto rounded-lg border border-slate-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            {/* Citations display */}
            {citations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  Citations ({citations.length})
                </div>
                <div className="space-y-1">
                  {citations.map((citation: any) => (
                    <a
                      key={citation.id}
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      {citation.title || citation.url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Endorse button */}
            <button
              onClick={endorse}
              className={`
             px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl shadow-md  transition-all duration-100 

                ${viewerEnd
                  ? 'px-4 py-2 text-[12.5px] tracking-wide  font-medium rounded-lg   bg-indigo-50/50   '
                  : 'px-4 py-2 text-[12.5px] tracking-wide  font-medium rounded-lg  bg-transparent '
                }
              `}
            >
                    <CheckSquare 
               className={`w-4 h-4 ${viewerEnd ? ' stroke-indigo-700' : ''}`} />

              {viewerEnd ? 'Endorsed' : 'Endorse'}
            </button>

            {/* Reply button */}
            <button
              onClick={() => setOpenReply(!openReply)}
              className="
             px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl shadow-md  transition-all duration-100 

              "
            >
              <Send className="w-4 h-4" />

              Respond
            </button>

            {/* Copy link button */}
            <button
              onClick={copyLink}
              className="
             px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl shadow-md  transition-all duration-100 

              "
              title="Copy link"
            >
              <Share className="w-4 h-4" />
              {showCopied ? 'Copied!' : 'Share'}
            </button>

             {/* Copy link button */}
            <button
              onClick={openReplies}
              className="
             px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl shadow-md  transition-all duration-100 

              "
              title="View Replies"
            >
              <EnvelopeOpen className="w-4 h-4" />
              {/* <Share className="w-4 h-4" /> */}
              View Replies
            </button>

            <div className="flex-1" />
          {/* {listExpanded ? "Lock Scrolling" : "Enable Scrolling"} */}

            {/* Promote/promoted button */}
            {p.status === 'CLAIMED' && p.promotedClaimId ? (
              <a
                href={`/claim/${p.promotedClaimId}`}
                className="
                  px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-full
                "
              >
                <BookOpen className="w-4 h-4" />
                View Claim
              </a>
            ) : (
              <PromoteButton
                deliberationId={p.deliberationId}
                id={p.id}
                text={p.text}
                onPromoted={() => onRefresh()}
              />
            )}
          </div>

          {/* Reply input */}
          {openReply && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 animate-in slide-in-from-top duration-200">
              <textarea
                className="
                  w-full px-3 py-2 articlesearchfield rounded-lg
                  transition-all duration-200 resize-none
                  text-sm
                "
                rows={3}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Reply to this proposition..."
                autoFocus
              />
              <div className="flex items-center gap-4 mt-2">

             {/* px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl shadow-md  transition-all duration-100 

                ${viewerEnd
                  ? 'px-4 py-2 text-[12.5px] tracking-wide  font-medium rounded-lg   bg-indigo-50/50   '
                  : 'px-4 py-2 text-[12.5px] tracking-wide  font-medium rounded-lg  bg-transparent '
                }
              `} */}

                <button
                  onClick={() => {
                    setOpenReply(false);
                    setReplyText('');
                  }}
                  className="
                   px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl border-none bg-slate-100 outline-none transition-all duration-100 
                    text-slate-600 hover:bg-slate-200
                    
                  "
                >
                  Cancel
                </button>
                <button
                  onClick={postReply}
                  disabled={!replyText.trim()}
                  className="
                   px-4 py-2 text-[12px] tracking-wide btnv2 font-medium rounded-xl  transition-all duration-100 
                    disabled:opacity-50 
                    transition-all duration-100
          
                  "
                >
                  Post Reply
                </button>

              </div>
            </div>
          )}
        </div>
      </div>
    </article>
    {showRepliesModal && (
        <RepliesModal 
          propositionId={p.id} 
                    onClose={closeReplies} 

        />
      )}
      </>
  );
}

// Main component
export default function PropositionsList({
  deliberationId,
  onVisibleTextsChanged,
}: {
  deliberationId: string;
  onVisibleTextsChanged?: (texts: string[]) => void;
}) {
  const [claimed, setClaimed] = React.useState<'any' | 'yes' | 'no'>('any');
  const [q, setQ] = React.useState('');
  const [showFilters, setShowFilters] = React.useState(false);

  const getKey = (idx: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = prev?.nextCursor ? `&cursor=${encodeURIComponent(prev.nextCursor)}` : '';
    const cq = claimed !== 'any' ? `&claimed=${claimed}` : '';
    const qq = q ? `&q=${encodeURIComponent(q)}` : '';
    return `/api/deliberations/${encodeURIComponent(deliberationId)}/propositions?limit=${PAGE}${cursor}${cq}${qq}`;
  };

  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite(
    getKey, 
    fetcher, 
    { revalidateOnFocus: false }
  );

  const pages = data ?? [];
  const rows: PropositionRow[] = pages.flatMap(p => p?.items ?? []);

  React.useEffect(() => {
    onVisibleTextsChanged?.(rows.slice(0, 40).map(r => r.text || ''));
  }, [rows, onVisibleTextsChanged]);

  // Loading state
  if (!data && isValidating) {
    return (
      <section className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-600">Loading propositions...</p>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="w-full rounded-xl border border-rose-200 bg-rose-50 shadow-sm">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-sm font-medium text-rose-900 mb-2">Failed to load propositions</h3>
          <p className="text-xs text-rose-700 mb-4">{String(error?.message || 'Unknown error')}</p>
          <button
            onClick={() => mutate()}
            className="
              px-4 py-2 rounded-lg text-sm font-medium
              bg-rose-600 text-white hover:bg-rose-700
              transition-all duration-200 shadow-sm hover:shadow
            "
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  // Empty state
  if (!rows.length) {
    return (
      <section className="w-full rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
        <div className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No propositions yet</h3>
          <p className="text-sm text-slate-600  mx-auto">
            Be the first to share an idea! Propositions are workshopped thoughts that can be elevated to claims.
          </p>
        </div>
      </section>
    );
  }

  const nextCursor = data?.[data.length - 1]?.nextCursor ?? null;
  const activeFilters = (claimed !== 'any' || q.trim()) ? 1 : 0;

  return (
    <section className="w-full rounded-xl panel-edge-blue bg-white/50 border border-sky-500/50 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-indigo-700 bg-gradient-to-r from-slate-50 to-white ">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Propositions
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              {rows.length}
            </span>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              inline-flex items-center gap-2 px-2 py-1 rounded-lg text-sm font-medium btnv2--ghost
              transition-all duration-200
              ${showFilters || activeFilters > 0
                ? 'bg-indigo-100 text-indigo-700 '
                : 'bg-slate-100 text-slate-600  hover:bg-slate-200'
              }
            `}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 animate-in slide-in-from-top duration-200">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <label className="flex-1 min-w-[240px]">
                <span className="block text-xs font-medium text-slate-700 mb-1">Search</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search propositions..."
                    className="
                      w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300
                      focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                      transition-all duration-200 text-sm
                    "
                  />
                </div>
              </label>

              {/* Status filter */}
              <label className="min-w-[160px]">
                <span className="block text-xs font-medium text-slate-700 mb-1">Status</span>
                <select
                  value={claimed}
                  onChange={e => setClaimed(e.target.value as any)}
                  className="
                    w-full px-3 py-2 rounded-lg border border-slate-300
                    focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                    transition-all duration-200 text-sm
                    bg-white
                  "
                >
                  <option value="any">All Statuses</option>
                  <option value="no">Unclaimed</option>
                  <option value="yes">Claimed</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="h-[600px] custom-scrollbar ">

        <Virtuoso
          data={rows}
          computeItemKey={(_i, r) => r.id}
          rangeChanged={(range) => {
            const slice = rows.slice(range.startIndex, Math.min(rows.length, range.endIndex + 1));
            onVisibleTextsChanged?.(slice.map(x => x.text || ''));
          }}
          endReached={() => !isValidating && nextCursor && setSize(s => s + 1)}
          itemContent={(_index, r) => (
            <div className='custom-scrollbar px-3 py-2 rounded-xl ' id={`prop-${r.id}`}>
              <Row p={r} deliberationId={deliberationId} onRefresh={() => mutate()} />
            </div>
          )}
          components={{
            Footer: () => (
              <div className="py-6 text-center border-t border-slate-100">
                {isValidating ? (
                  <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    Loading more...
                  </div>
                ) : nextCursor ? (
                  <p className="text-sm text-slate-500">Scroll to load more</p>
                ) : (
                  <p className="text-sm text-slate-400">You've reached the end</p>
                )}
              </div>
            ),
          }}
        />
      </div>
    </section>
  );
}
