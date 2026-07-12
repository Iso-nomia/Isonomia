"use client";
import * as React from "react";

interface Snapshot {
  id: string;
  label: string | null;
  atTime: string;
  blockCount: number;
  pageTitle?: string;
}

export function SnapshotListModal({
  pageId,
  isOpen,
  onClose,
  onRestore,
}: {
  pageId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore?: () => void;
}) {
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    fetch(`/api/kb/pages/${pageId}/snapshots`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.snapshots)) {
          setSnapshots(data.snapshots);
        } else {
          setError("Failed to load snapshots");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [isOpen, pageId]);

  async function handleRestore(snapshotId: string) {
    if (!confirm("This will replace the current page content with this snapshot. Continue?")) {
      return;
    }

    setRestoring(snapshotId);
    setError(null);

    try {
      const res = await fetch(`/api/kb/pages/${pageId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Restore failed");
      }

      alert("Page restored successfully!");
      onRestore?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to restore snapshot");
    } finally {
      setRestoring(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Page Snapshots</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
          {loading && (
            <div className="text-center py-8 text-slate-500">
              Loading snapshots...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && snapshots.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No snapshots yet. Click &ldquo;snapshot&rdquo; to create one.
            </div>
          )}

          {!loading && !error && snapshots.length > 0 && (
            <div className="space-y-3">
              {snapshots.map((s) => (
                <div
                  key={s.id}
                  className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {s.label || "Untitled Snapshot"}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {new Date(s.atTime).toLocaleString()} • {s.blockCount}{" "}
                        blocks
                      </div>
                      {s.pageTitle && (
                        <div className="text-xs text-slate-500 mt-1">
                          &ldquo;{s.pageTitle}&rdquo;
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRestore(s.id)}
                      disabled={restoring !== null}
                      className="ml-4 px-3 py-1 text-xs rounded border hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {restoring === s.id ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 bg-slate-50 text-xs text-slate-600">
          💡 Tip: Snapshots capture the entire page state at a point in time.
          Restoring will replace all current blocks.
        </div>
      </div>
    </div>
  );
}
