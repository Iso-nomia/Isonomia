// components/citations/LibrarySearchModal.tsx
"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, 
  FileText, 
  Link2, 
  Image as ImageIcon, 
  Video, 
  FileType, 
  Clock, 
  Filter,
  Loader2,
  ChevronRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

// Block type configuration
const BLOCK_TYPES = {
  pdf: { icon: FileText, label: "PDF", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
  link: { icon: Link2, label: "Link", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
  image: { icon: ImageIcon, label: "Image", color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  video: { icon: Video, label: "Video", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
  text: { icon: FileType, label: "Text", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
} as const;

type BlockType = keyof typeof BLOCK_TYPES;

interface LibraryItem {
  id: string;
  title: string | null;
  file_url: string | null;
  thumb_urls: string[];
  blockType: BlockType;
  created_at: string;
  linkUrl?: string | null;
  linkSiteName?: string | null;
  linkImage?: string | null;
  linkFavicon?: string | null;
  imageUrl?: string | null;
  videoThumb?: string | null;
  stack?: { name: string } | null;
}

interface LibrarySearchModalProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onPick: (libraryPostId: string, item?: LibraryItem) => void;
  trigger?: React.ReactNode;
}

export default function LibrarySearchModal({
  open,
  onOpenChange,
  onPick,
  trigger,
}: LibrarySearchModalProps) {
  const [selfOpen, setSelfOpen] = React.useState(false);
  const isControlled = typeof open === "boolean";
  const o = isControlled ? open! : selfOpen;
  const setO = isControlled ? (onOpenChange ?? (() => {})) : setSelfOpen;

  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [recentItems, setRecentItems] = React.useState<LibraryItem[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<BlockType | "all">("all");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showFilters, setShowFilters] = React.useState(false);
  const [loadedRecent, setLoadedRecent] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search when debounced query changes
  React.useEffect(() => {
    if (debouncedQuery) {
      searchLibrary(debouncedQuery, typeFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, typeFilter]);

  // Load recent items when modal opens
  React.useEffect(() => {
    if (o && !loadedRecent) {
      loadRecent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, loadedRecent]);

  // Focus input when modal opens
  React.useEffect(() => {
    if (o) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [o]);

  // Reset selected index when items change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [items, recentItems]);

  async function loadRecent() {
    try {
      const res = await fetcher("/api/library/search?recent=true&limit=8");
      setRecentItems(res.items ?? []);
      setLoadedRecent(true);
    } catch (e) {
      console.error("Failed to load recent items:", e);
    }
  }

  async function searchLibrary(q: string, filter: BlockType | "all") {
    setLoading(true);
    try {
      const typeParam = filter !== "all" ? `&type=${filter}` : "";
      const res = await fetcher(`/api/library/search?q=${encodeURIComponent(q)}${typeParam}`);
      setItems(res.items ?? []);
    } catch (e) {
      console.error("Search failed:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Get display items (search results or recent)
  const displayItems = query ? items : recentItems;

  // Filter by type if set (client-side fallback)
  const filteredItems = typeFilter === "all" 
    ? displayItems 
    : displayItems.filter(item => item.blockType === typeFilter);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      scrollToSelected();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      scrollToSelected();
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      pickItem(filteredItems[selectedIndex]);
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        setO(false);
      }
    }
  }

  function scrollToSelected() {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      const item = list.querySelector(`[data-index="${selectedIndex}"]`);
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function pickItem(item: LibraryItem) {
    onPick(item.id, item);
    setO(false);
    setQuery("");
  }

  function getItemThumbnail(item: LibraryItem): string | null {
    if (item.thumb_urls?.length > 0) return item.thumb_urls[0];
    if (item.linkImage) return item.linkImage;
    if (item.imageUrl) return item.imageUrl;
    if (item.videoThumb) return item.videoThumb;
    return null;
  }

  function getItemSubtitle(item: LibraryItem): string {
    if (item.blockType === "link" && item.linkSiteName) {
      return item.linkSiteName;
    }
    if (item.stack?.name) {
      return `in ${item.stack.name}`;
    }
    if (item.created_at) {
      const date = new Date(item.created_at);
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
    return "";
  }

  const BlockIcon = ({ type }: { type: BlockType }) => {
    const config = BLOCK_TYPES[type] || BLOCK_TYPES.pdf;
    const Icon = config.icon;
    return <Icon className={cn("h-3.5 w-3.5", config.color)} />;
  };

  return (
    <Dialog open={o} onOpenChange={setO}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-[600px] p-0 gap-0 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header with search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <DialogHeader className="mb-3">
            <DialogTitle className="text-base font-semibold">Find a library item</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              placeholder="Search your library by title, URL, site..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {query && !loading && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-3">
            <button
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors",
                showFilters || typeFilter !== "all"
                  ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3 w-3" />
              Filter
              {typeFilter !== "all" && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px]">1</span>
              )}
            </button>

            {showFilters && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  className={cn(
                    "px-2 py-1 text-xs rounded-full border transition-colors",
                    typeFilter === "all"
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                  onClick={() => setTypeFilter("all")}
                >
                  All
                </button>
                {Object.entries(BLOCK_TYPES).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors",
                        typeFilter === key
                          ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                      onClick={() => setTypeFilter(key as BlockType)}
                    >
                      <Icon className={cn("h-3 w-3", config.color)} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Results list */}
        <div 
          ref={listRef}
          className="max-h-[400px] overflow-y-auto"
        >
          {/* Section header */}
          {!query && filteredItems.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <Clock className="h-3 w-3" />
              Recent items
            </div>
          )}

          {query && !loading && filteredItems.length > 0 && (
            <div className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
            </div>
          )}

          {/* Items */}
          {filteredItems.map((item, index) => {
            const thumbnail = getItemThumbnail(item);
            const isSelected = index === selectedIndex;
            const config = BLOCK_TYPES[item.blockType] || BLOCK_TYPES.pdf;

            return (
              <div
                key={item.id}
                data-index={index}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0",
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
                onClick={() => pickItem(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {/* Thumbnail or icon */}
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden",
                  thumbnail ? "bg-slate-100 dark:bg-slate-800" : config.bg
                )}>
                  {thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      src={thumbnail} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <BlockIcon type={item.blockType} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <BlockIcon type={item.blockType} />
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title || item.linkUrl || item.file_url || "Untitled"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {getItemSubtitle(item)}
                  </div>
                </div>

                {/* Pick indicator */}
                <ChevronRight className={cn(
                  "h-4 w-4 text-slate-300 dark:text-slate-600 transition-colors flex-shrink-0",
                  isSelected && "text-blue-500"
                )} />
              </div>
            );
          })}

          {/* Empty states */}
          {!loading && query && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Search className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No results found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Try a different search term or adjust filters
              </p>
            </div>
          )}

          {!loading && !query && filteredItems.length === 0 && loadedRecent && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Your library is empty</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Add PDFs, links, or other content to get started
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">Enter</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">Esc</kbd>
              {query ? "Clear" : "Close"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
