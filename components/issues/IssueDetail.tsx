// components/issues/IssueDetail.tsx
'use client';
import * as React from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LegalMoveChips } from '../dialogue/LegalMoveChips';
import { TargetType } from '@prisma/client';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Trash2, User, X, Plus, Link2, Search, HelpCircle, Shield } from 'lucide-react';
import { IssueEntityPicker } from './IssueEntityPicker';
import { NCMReviewCard } from './NCMReviewCard';
import { useMicroToast } from '@/hooks/useMicroToast';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

type TargetTypeOption =  'claim' | 'inference';
type RoleOption = 'related' | 'blocks' | 'depends_on' | 'warrant' | 'evidence';

export default function IssueDetail({
  deliberationId,
  issueId,
  onClose,
}: {
  deliberationId: string;
  issueId: string;
  onClose: () => void;
}) {
  const key = `/api/deliberations/${encodeURIComponent(deliberationId)}/issues/${encodeURIComponent(issueId)}`;
  const { data, isLoading } = useSWR<{ ok: true; issue: any; links: any[] }>(
    key,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [resolveTarget, setResolveTarget] = React.useState<{
    targetType: TargetTypeOption;
    targetId: string;
  } | null>(null);

  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [assigneeInput, setAssigneeInput] = React.useState('');
  const toast = useMicroToast();
  
  // Clarification answer state
  const [answerText, setAnswerText] = React.useState('');
  
  // NCM data state
  const [ncmData, setNcmData] = React.useState<any>(null);
  const [loadingNcm, setLoadingNcm] = React.useState(false);
  
  // Link creation state
  const [isAddingLink, setIsAddingLink] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [newLink, setNewLink] = React.useState<{
    targetType: TargetTypeOption;
    targetId: string;
    targetLabel?: string;
    role: RoleOption;
  }>({
    targetType: 'claim',
    targetId: '',
    role: 'related',
  });

  async function setState(next: 'open' | 'closed') {
    setActionLoading('state');
    try {
      await fetch(key, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: next }),
      });
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      await globalMutate(key);
      setConfirmClose(false);
    } finally {
      setActionLoading(null);
    }
  }

  async function unlinkPoly(tt: TargetTypeOption, tid: string) {
    setActionLoading(`unlink-${tt}-${tid}`);
    try {
      await fetch(
        `${key}?targetType=${encodeURIComponent(tt)}&targetId=${encodeURIComponent(tid)}`,
        { method: 'DELETE' }
      );
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      await globalMutate(key);
      if (resolveTarget?.targetType === tt && resolveTarget?.targetId === tid) {
        setResolveTarget(null);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function setAssignee(uid: string) {
    if (!uid.trim()) return;
    setActionLoading('assignee');
    try {
      await fetch(key, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assigneeId: uid, state: 'pending' }),
      });
      await globalMutate(key);
      setAssigneeInput('');
    } finally {
      setActionLoading(null);
    }
  }

  async function addLink() {
    if (!newLink.targetId.trim()) return;
    
    setActionLoading('addLink');
    try {
      await fetch(key, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetType: newLink.targetType,
          targetId: newLink.targetId.trim(),
          role: newLink.role,
        }),
      });
      
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      await globalMutate(key);
      
      // Reset form
      setNewLink({
        targetType: 'claim',
        targetId: '',
        targetLabel: undefined,
        role: 'related',
      });
      setIsAddingLink(false);
    } catch (error) {
      console.error('Failed to add link:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function submitAnswer() {
    if (!answerText.trim()) return;
    
    setActionLoading('answer');
    try {
      await fetch(`${key}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answerText }),
      });
      
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      await globalMutate(key);
      setAnswerText('');
      toast.show('Answer submitted successfully!', 'ok');
    } catch (error) {
      console.error('Failed to submit answer:', error);
      toast.show('Failed to submit answer', 'err');
    } finally {
      setActionLoading(null);
    }
  }

  async function approveNCM() {
    setActionLoading('approve');
    try {
      await fetch(`${key}/approve-ncm`, {
        method: 'POST',
      });
      
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      await globalMutate(key);
      toast.show('Response approved and executed!', 'ok');
    } catch (error) {
      console.error('Failed to approve NCM:', error);
      toast.show('Failed to approve response', 'err');
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectNCM(reviewNotes: string) {
    setActionLoading('reject');
    try {
      await fetch(`${key}/reject-ncm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewNotes }),
      });
      
      window.dispatchEvent(new CustomEvent('issues:refresh', { detail: { deliberationId } }));
      await globalMutate(key);
      toast.show('Response rejected with feedback', 'ok');
    } catch (error) {
      console.error('Failed to reject NCM:', error);
      toast.show('Failed to reject response', 'err');
    } finally {
      setActionLoading(null);
    }
  }

  // Fetch NCM data if this is a community_defense issue
  React.useEffect(() => {
    if (data?.issue?.kind === 'community_defense' && data?.issue?.ncmId) {
      setLoadingNcm(true);
      fetch(`/api/non-canonical/by-id?id=${data.issue.ncmId}`)
        .then(r => r.json())
        .then(result => {
          if (result.ncm) {
            setNcmData(result.ncm);
          }
        })
        .catch(err => console.error('Failed to load NCM:', err))
        .finally(() => setLoadingNcm(false));
    }
  }, [data?.issue?.kind, data?.issue?.ncmId]);

  if (isLoading || !data?.issue) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="bg-white rounded-xl sm:max-w-[700px]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const it = data.issue;
  const isOpen = it.state === 'open';

  return (
    <>
      {toast.node}
      {/* Main Issue Dialog */}
      <Dialog 
        open={!showPicker} 
        onOpenChange={(o) => {
          if (!o && !showPicker) {
            onClose();
          }
        }}
      >
        <DialogContent className="bg-sky-800/25 backdrop-blur-xl shadow-white/50 shadow-lg rounded-2xl max-w-4xl px-8 py-6
        max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 space-y-1 gap-4 min-w-0">
                <DialogTitle className="text-2xl font-semibold text-white ">
                  {it.label}
                </DialogTitle>
                <div className="flex gap-3">
                  <span
                    className={`flex items-center align-center my-auto gap-1 px-2 py-1 rounded-xl  text-xs font-medium ${
                      isOpen
                        ? 'bg-orange-100 border border-orange-200 text-orange-800'
                        : 'bg-emerald-100 border border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {isOpen ? (
                      <AlertCircle className="h-3.5 w-3.5 " />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {it.state}
                  </span>
                  {it.assignee && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700">
                      <User className="h-3.5 w-3.5" />
                      {it.assignee.username || it.assignee.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
            {/* Metadata bar */}
            <div className="flex items-center gap-4 text-xs text-neutral-200 pb-2 border-b border-white/20">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium">Created by:</span>
                {it.createdBy?.username || it.createdBy?.name || 'Unknown'}
              </span>
              {it.answeredBy && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Answered by:</span>
                  {it.answeredBy.username || it.answeredBy.name}
                </span>
              )}
            </div>
            
            {/* Description */}
            {it.description && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-100 mb-2">
                  Description
                </h3>
                <p className="text-sm border border-white text-white rounded-lg w-fit px-3 py-1 bg-sky-600 tracking-wide leading-relaxed">
                  {it.description}
                </p>
              </section>
            )}

            {/* Clarification Q&A Section */}
            {it.kind === 'clarification' && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-100 mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-sky-300" />
                  Clarification Request
                </h3>
                
                {/* Question */}
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
                  <div className="text-xs font-medium text-sky-900 mb-2 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Question
                  </div>
                  <p className="text-sm text-sky-800 leading-relaxed">
                    {it.questionText || 'No question provided'}
                  </p>
                </div>

                {/* Answer (if provided) */}
                {it.answerText ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-xs font-medium text-green-900 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Answer {it.answeredAt && `• ${new Date(it.answeredAt).toLocaleDateString()}`}
                    </div>
                    <p className="text-sm text-green-800 leading-relaxed">
                      {it.answerText}
                    </p>
                  </div>
                ) : (
                  /* Answer Form (for author) */
                  <div className="p-4 bg-white border border-neutral-200 rounded-lg space-y-3">
                    <div className="text-xs font-medium text-neutral-700">
                      Your Answer
                    </div>
                    <textarea 
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent min-h-[100px] resize-y"
                      placeholder="Provide a detailed answer to this clarification request..."
                      disabled={actionLoading === 'answer'}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">
                        {answerText.length} / 5000 characters
                      </span>
                      <button 
                        onClick={submitAnswer}
                        disabled={!answerText.trim() || actionLoading === 'answer'}
                        className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {actionLoading === 'answer' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Submit Answer
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Community Defense / NCM Review Section */}
            {it.kind === 'community_defense' && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-100 mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-300" />
                  Community Defense Review
                </h3>
                
                {loadingNcm ? (
                  <div className="flex items-center justify-center py-8 bg-white rounded-lg border border-neutral-200">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  </div>
                ) : ncmData ? (
                  <NCMReviewCard
                    ncm={ncmData}
                    onApprove={approveNCM}
                    onReject={rejectNCM}
                    isLoading={actionLoading === 'approve' || actionLoading === 'reject'}
                  />
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    No community defense data found
                  </div>
                )}
              </section>
            )}

            {/* Assignee Management */}
            <section className='px-0'>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-100 mb-2">
                Assign User
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                  className="flex-1 articlesearchfield bg-white/80 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ml-.5 "
                  placeholder="Enter username..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setAssignee(assigneeInput);
                  }}
                  disabled={actionLoading === 'assignee'}
                />
                <button
                  onClick={() => setAssignee(assigneeInput)}
                  disabled={!assigneeInput.trim() || actionLoading === 'assignee'}
                  className="px-4 py-1 bg-sky-600 btnv2--ghost text-white text-sm font-medium rounded-lg hover:bg-sky-700 
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {actionLoading === 'assignee' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Assign'
                  )}
                </button>
              </div>
            </section>

            {/* Links */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className='inline-flex items-center gap-3'>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-100">
                  Linked Items
                </h3>
                <button
                  onClick={() => setIsAddingLink(!isAddingLink)}
                  className="inline-flex items-center gap-0 px-2.5 py-1.5 bg-sky-600 
                  btnv2--ghost text-white text-xs font-medium rounded-lg hover:bg-sky-700 transition-colors"
                >
                  {isAddingLink ? (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Add Link
                    </>
                  )}
                </button>
                </div>
              </div>

              {/* Add Link Form */}
              {isAddingLink && (
                <div className="mb-4 p-4 rounded-lg border border-indigo-300 bg-indigo-50/50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Target Type
                      </label>
                      <select
                        value={newLink.targetType}
                        onChange={(e) => {
                          setNewLink({
                            ...newLink,
                            targetType: e.target.value as TargetTypeOption,
                            targetId: '',
                            targetLabel: undefined,
                          });
                        }}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="claim">Claim</option>
                        <option value="inference">Inference</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Role
                      </label>
                      <select
                        value={newLink.role}
                        onChange={(e) => setNewLink({ ...newLink, role: e.target.value as RoleOption })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="related">Related</option>
                        <option value="blocks">Blocks</option>
                        <option value="depends_on">Depends On</option>
                        <option value="warrant">Warrant</option>
                        <option value="evidence">Evidence</option>
                      </select>
                    </div>
                  </div>

                  {/* Target Selection */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                      Target {newLink.targetType}
                    </label>
                    {newLink.targetLabel ? (
                      <div className="flex items-center gap-2 p-3 border border-indigo-300 rounded-lg bg-white">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-neutral-900 truncate">
                            {newLink.targetLabel}
                          </div>
                          <div className="text-xs font-mono text-neutral-500">
                            {newLink.targetId.slice(0, 12)}...
                          </div>
                        </div>
                        <button
                          onClick={() => setNewLink({ ...newLink, targetId: '', targetLabel: undefined })}
                          className="p-1 hover:bg-neutral-100 rounded transition-colors"
                        >
                          <X className="h-4 w-4 text-neutral-500" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPicker(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-indigo-800 rounded-lg text-sm text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        <Search className="h-4 w-4" />
                        Search {newLink.targetType}s
                      </button>
                    )}
                  </div>

                  <button
                    onClick={addLink}
                    disabled={!newLink.targetId.trim() || actionLoading === 'addLink'}
                    className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'addLink' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Create Link
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Existing Links List */}
              {(data.links ?? []).length === 0 ? (
                <div className="text-center py-8 text-sm text-neutral-500 bg-neutral-50 rounded-lg border border-dashed bg-white/80 border-neutral-300">
                  No linked items yet
                </div>
              ) : (
                <div className="space-y-2">
                  {data.links.map((l) => {
                    const isSelected =
                      resolveTarget?.targetType === l.targetType &&
                      resolveTarget?.targetId === l.targetId;
                    const isUnlinking = actionLoading === `unlink-${l.targetType}-${l.targetId}`;

                    return (
                      <div
                        key={`${l.targetType}:${l.targetId}`}
                        className={`group flex items-center gap-3 p-3 bg-white rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                            : 'bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-sm'
                        }`}
                      >
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="resolveTarget"
                            onChange={() =>
                              setResolveTarget({
                                targetType: l.targetType as TargetTypeOption,
                                targetId: l.targetId,
                              })
                            }
                            checked={isSelected}
                            className="h-4 w-4 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>

                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {l.targetType}
                        </span>

                        {l.role && l.role !== 'related' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                            {l.role}
                          </span>
                        )}

                        <a
                          href={`#${l.targetType}-${l.targetId}`}
                          className="flex-1 flex items-center gap-1.5 text-sm text-neutral-700 hover:text-indigo-600 font-mono transition-colors"
                          title="Jump to item"
                        >
                          {l.targetId.slice(0, 12)}…
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        <button
                          onClick={() => unlinkPoly(l.targetType as TargetTypeOption, l.targetId)}
                          disabled={isUnlinking}
                          className="ml-auto px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          title="Remove link"
                        >
                          {isUnlinking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Resolve Target */}
            {resolveTarget && (
              <section className="rounded-lg border border-indigo-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-900">
                    Resolve at Selected Target
                  </h3>
                  <button
                    onClick={() => setResolveTarget(null)}
                    className="text-indigo-700 hover:text-indigo-900 p-1"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <LegalMoveChips
                  deliberationId={deliberationId}
                  targetType={resolveTarget.targetType as TargetType}
                  targetId={resolveTarget.targetId}
                  onPosted={() => globalMutate(key)}
                />
              </section>
            )}
          </div>

          <DialogFooter className="border-t pt-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-1 border border-neutral-300 btnv2--ghost rounded-lg text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-300 transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {isOpen ? (
                confirmClose ? (
                  <>
                    <button
                      onClick={() => setConfirmClose(false)}
                      disabled={actionLoading === 'state'}
                      className="px-4 py-1 border border-neutral-300 bg-rose-50 rounded-lg text-sm font-medium text-neutral-700 hover:bg-rose-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setState('closed')}
                      disabled={actionLoading === 'state'}
                      className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {actionLoading === 'state' && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirm Close
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmClose(true)}
                    className="px-4 py-2 bg-orange-600 btnv2--ghost text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Close Issue
                  </button>
                )
              ) : (
                <button
                  onClick={() => setState('open')}
                  disabled={actionLoading === 'state'}
                  className="px-4 py-2 bg-emerald-600 btnv2--ghost text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading === 'state' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  Reopen Issue
                </button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Picker Modal - Rendered outside Dialog */}
      {showPicker && (
        <IssueEntityPicker
          deliberationId={deliberationId}
          targetType={newLink.targetType as 'claim' | 'inference'}
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onPick={(item) => {
            setNewLink({
              ...newLink,
              targetId: item.id,
              targetLabel: item.label,
            });
            setShowPicker(false);
          }}
        />
      )}
    </>
  );
}