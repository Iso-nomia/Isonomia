"use client";

import * as React from "react";
import useSWR from "swr";
import { Loader2, Plus, Shield, Trash2, X } from "lucide-react";
import clsx from "clsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

type Visibility = "public" | "unlisted" | "private";

interface ModeratorEntry {
  userId: string;
  addedAt?: string;
  user?: { id?: string; username?: string; name?: string; image?: string | null } | null;
}

interface DeliberationSettingsModalProps {
  deliberationId: string;
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: "public", label: "Public", description: "Listed and world-readable (surfaced in the Agora)." },
  { value: "unlisted", label: "Unlisted", description: "Link-only; not surfaced in feeds." },
  { value: "private", label: "Private", description: "Restricted to the creator and assigned moderators." },
];

/**
 * Settings modal for a deliberation. Currently exposes visibility and moderator
 * management. Both sections are editable only when the current user is the
 * deliberation creator; otherwise they render read-only.
 */
export function DeliberationSettingsModal({
  deliberationId,
  currentUserId,
  open,
  onOpenChange,
}: DeliberationSettingsModalProps) {
  const {
    data: settings,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR(open ? `/api/deliberations/${deliberationId}/settings` : null, fetcher, {
    revalidateOnFocus: false,
  });

  const {
    data: roles,
    isLoading: rolesLoading,
    mutate: mutateRoles,
  } = useSWR(open ? `/api/deliberations/${deliberationId}/roles` : null, fetcher, {
    revalidateOnFocus: false,
  });

  const isCreator =
    !!currentUserId && !!settings?.createdById && String(settings.createdById) === String(currentUserId);

  const [visibility, setVisibility] = React.useState<Visibility>("public");
  const [savingVisibility, setSavingVisibility] = React.useState(false);
  const [visibilityError, setVisibilityError] = React.useState<string | null>(null);

  const [newModerator, setNewModerator] = React.useState("");
  const [addingModerator, setAddingModerator] = React.useState(false);
  const [moderatorError, setModeratorError] = React.useState<string | null>(null);

  // Sync local visibility state when settings load.
  React.useEffect(() => {
    if (settings?.visibility) {
      setVisibility(settings.visibility as Visibility);
    }
  }, [settings?.visibility]);

  const moderators: ModeratorEntry[] = roles?.moderators ?? [];

  async function handleVisibilityChange(next: Visibility) {
    if (!isCreator || next === visibility) return;
    const prev = visibility;
    setVisibility(next);
    setSavingVisibility(true);
    setVisibilityError(null);
    try {
      const res = await fetch(`/api/deliberations/${deliberationId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update visibility");
      }
      await mutateSettings();
    } catch (err: any) {
      setVisibility(prev);
      setVisibilityError(err.message || "Failed to update visibility");
    } finally {
      setSavingVisibility(false);
    }
  }

  async function handleAddModerator(e: React.FormEvent) {
    e.preventDefault();
    const value = newModerator.trim();
    if (!value || !isCreator) return;
    setAddingModerator(true);
    setModeratorError(null);
    try {
      const res = await fetch(`/api/deliberations/${deliberationId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add moderator");
      }
      setNewModerator("");
      await mutateRoles();
    } catch (err: any) {
      setModeratorError(err.message || "Failed to add moderator");
    } finally {
      setAddingModerator(false);
    }
  }

  async function handleRemoveModerator(userId: string) {
    if (!isCreator) return;
    setModeratorError(null);
    try {
      const res = await fetch(
        `/api/deliberations/${deliberationId}/roles?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove moderator");
      }
      await mutateRoles();
    } catch (err: any) {
      setModeratorError(err.message || "Failed to remove moderator");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Deliberation Settings
          </DialogTitle>
          <DialogDescription>
            {isCreator
              ? "Manage visibility and moderators for this deliberation."
              : "Only the creator can change these settings."}
          </DialogDescription>
        </DialogHeader>

        {settingsLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading settings…
          </div>
        ) : settingsError ? (
          <div className="text-sm text-red-600 py-6">Failed to load settings.</div>
        ) : (
          <div className="space-y-6">
            {/* Visibility */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Visibility</h3>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={clsx(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      visibility === opt.value
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-slate-200 hover:bg-slate-50",
                      (!isCreator || savingVisibility) && "cursor-not-allowed opacity-80"
                    )}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={visibility === opt.value}
                      disabled={!isCreator || savingVisibility}
                      onChange={() => handleVisibilityChange(opt.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.description}</div>
                    </div>
                  </label>
                ))}
              </div>
              {visibilityError && (
                <div className="text-xs text-red-600 mt-2">{visibilityError}</div>
              )}
            </section>

            {/* Moderators */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Moderators</h3>
              <p className="text-xs text-slate-500 mb-3">
                Moderators share governance authority with the creator (role management,
                moderation actions).
              </p>

              {isCreator && (
                <form onSubmit={handleAddModerator} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newModerator}
                    onChange={(e) => setNewModerator(e.target.value)}
                    placeholder="Add by username"
                    disabled={addingModerator}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={addingModerator || !newModerator.trim()}
                    className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {addingModerator ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add
                  </button>
                </form>
              )}

              {moderatorError && (
                <div className="text-xs text-red-600 mb-2">{moderatorError}</div>
              )}

              {rolesLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading moderators…
                </div>
              ) : moderators.length === 0 ? (
                <div className="text-sm text-slate-500 py-3 px-3 rounded-lg border border-dashed border-slate-200">
                  No moderators yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {moderators.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {m.user?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.user.image}
                            alt={m.user.username || m.userId}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600">
                            {(m.user?.username || m.userId).slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-slate-800 truncate">
                            {m.user?.name || m.user?.username || `User ${m.userId}`}
                          </div>
                          {m.user?.username && (
                            <div className="text-xs text-slate-500 truncate">@{m.user.username}</div>
                          )}
                        </div>
                      </div>
                      {isCreator && (
                        <button
                          onClick={() => handleRemoveModerator(m.userId)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Remove moderator"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
