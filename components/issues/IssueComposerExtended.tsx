// components/issues/IssueComposerExtended.tsx
'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { HelpCircle, Shield, AlertCircle } from 'lucide-react';
import { useMicroToast } from '@/hooks/useMicroToast';

type IssueKind = 'general' | 'clarification' | 'community_defense';

export function IssueComposer({
  deliberationId,
  kind = 'general',
  initialArgumentId,
  initialTarget,
  initialLabel,
  questionText: initialQuestion,
  ncmId,
  open,
  onOpenChange,
  onCreated,
}: {
  deliberationId: string;
  kind?: IssueKind;
  initialArgumentId?: string;
  initialTarget?: { type: 'argument' | 'claim' | 'card'; id: string };
  initialLabel?: string;
  questionText?: string;
  ncmId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (issueId: string) => void;
}) {
  const [label, setLabel] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [questionText, setQuestionText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const toast = useMicroToast();

  React.useEffect(() => {
    if (open) {
      setLabel(initialLabel ?? '');
      setDesc('');
      setQuestionText(initialQuestion ?? '');
    }
  }, [open, initialLabel, initialQuestion]);

  async function submit() {
    if (kind === 'clarification' && !questionText.trim()) return;
    if (kind !== 'clarification' && !label.trim()) return;

    setBusy(true);
    try {
      // Ensure label doesn't exceed 120 characters
      const finalLabel = (label.trim() || `Clarification Request`).slice(0, 120);
      
      const payload: any = {
        kind,
        label: finalLabel,
        description: desc.trim() || undefined,
        links: initialArgumentId ? [initialArgumentId] : undefined,
        targets: initialTarget
          ? [{ type: initialTarget.type, id: initialTarget.id, role: 'related' }]
          : undefined,
      };

      // Add clarification-specific fields
      if (kind === 'clarification') {
        payload.questionText = questionText.trim();
      }

      // Add NCM-specific fields
      if (kind === 'community_defense' && ncmId) {
        payload.ncmId = ncmId;
      }

      const res = await fetch(
        `/api/deliberations/${encodeURIComponent(deliberationId)}/issues`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());
      const { issue } = await res.json();
      window.dispatchEvent(
        new CustomEvent('issues:refresh', { detail: { deliberationId } })
      );
      
      // Show success toast
      if (kind === 'clarification') {
        toast.show('Clarification request sent!', 'ok');
      } else if (kind === 'community_defense') {
        toast.show('Review issue created successfully!', 'ok');
      } else {
        toast.show('Issue created successfully!', 'ok');
      }
      
      onCreated?.(issue.id);
      onOpenChange(false);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to create issue', 'err');
    } finally {
      setBusy(false);
    }
  }

  const getIcon = () => {
    switch (kind) {
      case 'clarification':
        return <HelpCircle className="w-5 h-5 text-indigo-600" />;
      case 'community_defense':
        return <Shield className="w-5 h-5 text-emerald-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const getTitle = () => {
    switch (kind) {
      case 'clarification':
        return 'Request Clarification';
      case 'community_defense':
        return 'Review Community Defense';
      default:
        return 'Open an issue';
    }
  };

  const getSubmitLabel = () => {
    switch (kind) {
      case 'clarification':
        return 'Submit Question';
      case 'community_defense':
        return 'Create Review Issue';
      default:
        return 'Open issue';
    }
  };

  return (
    <>
      {toast.node}
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="bg-slate-50 rounded-xl sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {kind === 'clarification' ? (
            <>
              {/* Clarification Question Mode */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="text-xs text-indigo-800 mb-2 font-medium">
                  💡 Ask a specific question about this content
                </div>
                <p className="text-xs text-indigo-700">
                  Your question will be sent to the author, who can provide an
                  answer visible to everyone.
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 mb-1 block">
                  Your Question
                </span>
                <textarea
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                    placeholder:text-slate-400"
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g., How did you calculate the median in premise 2?"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  {questionText.length}/500 characters
                </span>
              </label>

              {/* Optional: Additional context */}
              <label className="block">
                <span className="text-xs text-slate-600 mb-1 block">
                  Additional Context (optional)
                </span>
                <textarea
                  className="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Any additional details..."
                />
              </label>
            </>
          ) : (
            <>
              {/* Standard Issue Mode */}
              <label className="block">
                <span className="text-[11px] text-neutral-600">Label</span>
                <input
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Data validity"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-neutral-600">
                  Description (optional)
                </span>
                <textarea
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  rows={4}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          <button
            className="px-3 py-2 border rounded-lg text-sm hover:bg-slate-100 transition"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition
              ${
                kind === 'clarification'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : kind === 'community_defense'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-700 hover:bg-slate-800'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            onClick={submit}
            disabled={
              busy ||
              (kind === 'clarification'
                ? !questionText.trim()
                : !label.trim())
            }
          >
            {busy ? 'Submitting…' : getSubmitLabel()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
