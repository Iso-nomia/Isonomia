'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import type { CommentThread } from '@/types/comments';

interface CommentModalProps {
  thread: CommentThread;
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
  onAfterChange?: (t: CommentThread) => void; // notify parent to refresh
}
export default function CommentModal({
  thread: initialThread,
  open,
  onClose,
  currentUserId,
  onAfterChange,
}: CommentModalProps) {
  // keep a local shadow so modal feels responsive
  const [thread, setThread] = useState<CommentThread>(initialThread);
  const [replyBody, setReplyBody] = useState('');
  const [pending, setPending] = useState(false);

  // update if parent thread changes
  // (optional) useEffect(() => setThread(initialThread), [initialThread]);

  const comment = thread.comments[0]; // head

  async function handleVote(commentId: string, delta: 1 | -1) {
    try {
      const res = await fetch(`/api/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      // reflect in local state
      setThread(t => ({
        ...t,
        comments: t.comments.map(c =>
          c.id === updated.id ? { ...c, upvotes: updated.upvotes, downvotes: updated.downvotes } : c
        ),
      }));
      onAfterChange?.({
        ...thread,
        comments: thread.comments.map(c =>
          c.id === updated.id ? { ...c, upvotes: updated.upvotes, downvotes: updated.downvotes } : c
        ),
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReply(parentCommentId: string) {
    if (!replyBody.trim()) return;
    setPending(true);
    try {
      const res = await fetch(`/api/comments/${parentCommentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody }),
      });
      const newComment = await res.json();
      if (!res.ok || newComment.error) throw new Error(newComment.error ?? 'reply_failed');
      const next = { ...thread, comments: [...thread.comments, newComment] };
      setThread(next);
      setReplyBody('');
      onAfterChange?.(next);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not reply');
    } finally {
      setPending(false);
    }
  }

  async function handleResolve() {
    try {
      const res = await fetch(`/api/comment-threads/${thread.id}/resolve`, { method: 'POST' });
      if (!res.ok) return;
      const next = { ...thread, resolved: true };
      setThread(next);
      onAfterChange?.(next);
    } catch (e) { console.error(e); }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) return;
      const next = { ...thread, comments: thread.comments.filter(c => c.id !== commentId) };
      setThread(next);
      onAfterChange?.(next);
    } catch (e) { console.error(e); }
  }
  const isAuthor = currentUserId === thread.createdBy;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[700px] max-h-[500px] overflow-y-auto bg-slate-200 p-3">
        <DialogHeader>
          <DialogTitle hidden>Comment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {thread.comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-slate-500 mb-1">
                by {c.createdBy} · {new Date(c.createdAt).toLocaleString()}
              </div>
              <p className="text-[0.95rem] leading-6 whitespace-pre-wrap">{c.body}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="px-3 py-0 text-xs rounded border border-slate-300 hover:bg-slate-50"
                  onClick={() => handleVote(c.id, 1)}
                >
                  ▲ {c.upvotes}
                </button>
                <button
                  className="px-3 py-0 text-xs rounded border border-slate-300 hover:bg-slate-50"
                  onClick={() => handleVote(c.id, -1)}
                >
                  ▼ {c.downvotes}
                </button>
                {isAuthor && thread.comments.length > 1 && (
                  <button
                    className="ml-auto text-xs text-rose-600 underline"
                    onClick={() => handleDelete(c.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
            {/* Reply box */}
            {!thread.resolved && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <textarea
                className="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Write a reply…"
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                rows={3}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="px-4 py-1 text-sm rounded-md text-slate-900 savebutton disabled:opacity-50"
                  onClick={() => handleReply(thread.comments[0].id)}
                  disabled={pending || !replyBody.trim()}
                >
                  {pending ? 'Posting…' : 'Reply'}
                </button>
                {isAuthor && (
                  <button
                    className="ml-auto px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50"
                    onClick={handleResolve}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          )}

        
        </div>
        <DialogFooter>
          <DialogClose className="px-4 py-1 savebutton text-sm  bg-white rounded-md">
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
