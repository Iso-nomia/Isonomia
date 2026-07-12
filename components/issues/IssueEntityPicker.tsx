// components/issues/IssueEntityPicker.tsx
'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2 } from 'lucide-react';

type TargetType = 'claim' | 'inference';
type Item = {
  id: string;
  label: string;
  subtitle?: string;
};

export function IssueEntityPicker({
  deliberationId,
  targetType,
  open,
  onClose,
  onPick,
}: {
  deliberationId: string;
  targetType: TargetType;
  open: boolean;
  onClose: () => void;
  onPick: (item: Item) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // Ensure we only render on client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const fetchItems = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/deliberations/${encodeURIComponent(
          deliberationId
        )}/entity-search?targetType=${targetType}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        console.error('Entity search error:', err);
        setError('Failed to search. Please try again.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchItems, 300);
    return () => clearTimeout(timeoutId);
  }, [open, query, targetType, deliberationId]);

  if (!open || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999]  bg-black/40 backdrop-blur-sm flex items-start justify-center pt-20"
      style={{ pointerEvents: 'auto' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl transition-opacity duration-200"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center  justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Select {targetType}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-100 transition-colors"
            aria-label="Close"
            type="button"
          >
            <X className="h-4 w-4 text-neutral-500" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${targetType}s...`}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              style={{ pointerEvents: 'auto' }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96  overflow-y-auto" style={{ pointerEvents: 'auto' }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-sm text-red-600">{error}</div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="p-8 text-center text-sm text-neutral-500">
              {query
                ? 'No results found. Try a different search term.'
                : `No ${targetType}s available in this deliberation.`}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors group cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                    onClick={() => {
                      onPick(item);
                      onClose();
                    }}
                  >
                    <div className="text-sm text-neutral-900 line-clamp-2 group-hover:text-indigo-900">
                      {item.label}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-neutral-500 group-hover:text-indigo-600">
                        {item.id.slice(0, 12)}...
                      </span>
                      {item.subtitle && (
                        <>
                          <span className="text-neutral-300">•</span>
                          <span className="text-xs text-neutral-500">
                            {item.subtitle}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 bg-neutral-50 flex justify-between items-center">
          <div className="text-xs text-neutral-500">
            {items.length > 0 && `${items.length} result${items.length === 1 ? '' : 's'}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
            style={{ pointerEvents: 'auto' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // Render the modal using a portal to document.body
  return createPortal(modalContent, document.body);
}