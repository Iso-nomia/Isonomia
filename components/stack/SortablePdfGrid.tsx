// components/stack/SortablePdfGrid.tsx
"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import PdfLightbox from "@/components/modals/PdfLightbox";
import { LinkBlockCard } from "@/components/blocks/LinkBlockCard";
import { TextBlockCard } from "@/components/blocks/TextBlockCard";
import { VideoBlockCard } from "@/components/blocks/VideoBlockCard";
import { StackEmbedCard, EmbeddedStackData } from "@/components/stack/blocks/StackEmbedCard";
import { ConnectButton } from "@/components/stack/ConnectButton";
import { ContextsPanel } from "@/components/stack/ContextsPanel";
import { removeFromStack, setStackOrder } from "@/lib/actions/stack.actions";
import { Link2Icon } from "lucide-react";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
function deriveThumbFromPdfUrl(fileUrl?: string|null) {
  if (!fileUrl) return null;
  const m = fileUrl.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)\.pdf$/i);
  return m ? `${SUPA}/storage/v1/object/public/pdf-thumbs/${m[1]}.png` : null;
}

// Block type enum (matches Prisma schema)
type BlockType = "pdf" | "link" | "text" | "image" | "video" | "dataset" | "embed";

// StackItem kind enum
type StackItemKind = "block" | "stack_embed";

/** Extended tile shape supporting all block types and stack embeds */
export type StackPostTile = {
  id: string;  // StackItem.id for embeds, LibraryPost.id for blocks
  kind?: StackItemKind;  // "block" (default) or "stack_embed"
  title?: string | null;
  file_url?: string | null;  // Optional for non-PDF blocks
  thumb_urls?: string[] | null;
  blockType?: BlockType | null;
  processingStatus?: string | null;
  
  // Link fields
  linkUrl?: string | null;
  linkTitle?: string | null;
  linkDescription?: string | null;
  linkImage?: string | null;
  linkFavicon?: string | null;
  linkSiteName?: string | null;
  linkScreenshot?: string | null;
  
  // Text fields
  textContent?: string | null;
  textFormat?: string | null;
  
  // Video fields
  videoUrl?: string | null;
  videoProvider?: string | null;
  videoEmbedCode?: string | null;
  videoThumbnail?: string | null;
  videoDuration?: number | null;
  
  // Connection metadata (Phase 1.3)
  connectedStacksCount?: number;
  connectedStackIds?: string[];
  
  // Stack embed fields (Phase 1.4)
  embedStack?: EmbeddedStackData | null;
  note?: string | null;
  addedBy?: { id: string; name: string } | null;
  addedAt?: string | null;
};

type Props = {
  stackId: string;
  posts: StackPostTile[];     // MUST be in the current order (you already do this)
  editable: boolean;
};

export default function SortablePdfGrid({ stackId, posts, editable }: Props) {
  // local optimistic order
  const [items, setItems] = React.useState<StackPostTile[]>(posts);

  React.useEffect(() => {
    // keep in sync if server revalidates
    setItems(posts);
  }, [posts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Hidden form to invoke the server action `setStackOrder` on drag end
  const formRef = React.useRef<HTMLFormElement>(null);
  const orderInputRef = React.useRef<HTMLInputElement>(null);

  function onDragEnd(evt: any) {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((it) => it.id === String(active.id));
    const newIndex = items.findIndex((it) => it.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // optimistic

    // submit new order to the server
    const ids = next.map((i) => i.id);
    if (orderInputRef.current) orderInputRef.current.value = JSON.stringify(ids);
   if (formRef.current) formRef.current.requestSubmit(submitBtnRef.current ?? undefined);
  }
const submitBtnRef = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      {/* Hidden form posts to setStackOrder (server action) */}
      {editable && (
        <form action={setStackOrder} ref={formRef} className="hidden">
          <input type="hidden" name="stackId" value={stackId} />
          <input type="hidden" name="orderJson" ref={orderInputRef} />
           <button type="submit" ref={submitBtnRef} className="hidden" />
        </form>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={editable ? onDragEnd : undefined}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((p) => (
              <SortableTile
                key={p.id}
                tile={p}
                editable={editable}
                stackId={stackId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableTile({
  tile,
  editable,
  stackId,
}: {
  tile: StackPostTile;
  editable: boolean;
  stackId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tile.id });
  const [contextsOpen, setContextsOpen] = React.useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,.12)" : undefined,
  };

  const isStackEmbed = tile.kind === "stack_embed";
  const blockType = tile.blockType || "pdf"; // Default to PDF for legacy posts
  const title = isStackEmbed 
    ? (tile.embedStack?.name || "Embedded Stack")
    : (tile.title || (blockType === "pdf" ? "PDF" : "Untitled"));

  // Render stack embed
  if (isStackEmbed && tile.embedStack) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="group relative"
      >
        <StackEmbedCard
          stack={tile.embedStack}
          note={tile.note}
          addedBy={tile.addedBy}
          addedAt={tile.addedAt}
          compact
        />

        {/* Drag handle for embeds */}
        {editable && (
          <button
            className="absolute top-2 left-2 p-1 rounded bg-white/90 border opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing z-10"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="3" cy="3" r="1.5" />
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="13" cy="3" r="1.5" />
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
        )}

        {/* Remove button for embeds */}
        {editable && (
          <form action={removeFromStack} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
            <input type="hidden" name="stackId" value={stackId} />
            <input type="hidden" name="postId" value={tile.id} />
            <input type="hidden" name="kind" value="stack_embed" />
            <button
              className="px-2 py-1 text-xs rounded bg-white/90 border"
              type="submit"
            >
              ⌫
            </button>
          </form>
        )}
      </div>
    );
  }

  // Render the appropriate block content based on type
  const renderBlockContent = () => {
    switch (blockType) {
      case "link":
        return (
          <LinkBlockCard
            block={{
              id: tile.id,
              linkUrl: tile.linkUrl || null,
              linkTitle: tile.linkTitle || null,
              linkDescription: tile.linkDescription || null,
              linkImage: tile.linkImage || null,
              linkFavicon: tile.linkFavicon || null,
              linkSiteName: tile.linkSiteName || null,
              linkScreenshot: tile.linkScreenshot || null,
              processingStatus: tile.processingStatus || "complete",
              title: tile.title || null,
            }}
            compact
          />
        );

      case "text":
        return (
          <TextBlockCard
            block={{
              id: tile.id,
              textContent: tile.textContent || null,
              textFormat: tile.textFormat || null,
              title: tile.title || null,
            }}
            compact
          />
        );

      case "video":
        return (
          <VideoBlockCard
            block={{
              id: tile.id,
              videoUrl: tile.videoUrl || null,
              videoProvider: tile.videoProvider || null,
              videoEmbedCode: tile.videoEmbedCode || null,
              videoThumbnail: tile.videoThumbnail || null,
              videoDuration: tile.videoDuration || null,
              processingStatus: tile.processingStatus || "complete",
              title: tile.title || null,
            }}
            compact
          />
        );

      case "pdf":
      default:
        // PDF with lightbox
        const coverCandidate =
          tile.thumb_urls?.[0] ?? deriveThumbFromPdfUrl(tile.file_url) ?? "/assets/PDF.svg";
        return (
          <PdfTileContent
            tile={tile}
            coverCandidate={coverCandidate}
            title={title}
          />
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border overflow-hidden bg-white"
    >
      {renderBlockContent()}

      {/* Drag handle */}
      {editable && (
        <button
          className="absolute top-2 left-2 p-1 rounded bg-white/90 border opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing z-10"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          {/* 6-dot handle icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="13" cy="3" r="1.5" />
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>
      )}

      {/* Cite popover - only for PDFs and links */}
      {editable && (blockType === "pdf" || blockType === "link") && (
        <div className="absolute bottom-2 left-2 z-10">
          <CiteButton libraryPostId={tile.id} />
        </div>
      )}

      {/* Connect button - allows adding to other stacks */}
      {editable && (
        <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition">
          <ConnectButton
            blockId={tile.id}
            blockTitle={title}
            currentStackIds={tile.connectedStackIds || [stackId]}
            variant="icon"
            className="bg-white/90 border"
          />
        </div>
      )}

      {/* Connection count indicator - clickable to show contexts panel */}
      {(tile.connectedStacksCount ?? 0) > 1 && !editable && (
        <button
          onClick={() => setContextsOpen(true)}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs hover:bg-indigo-200 transition-colors"
          title="View all connections"
        >
          <Link2Icon className="h-3 w-3" />
          {tile.connectedStacksCount}
        </button>
      )}

      {/* Contexts panel - shows all stacks this block appears in */}
      <ContextsPanel
        open={contextsOpen}
        onClose={() => setContextsOpen(false)}
        blockId={tile.id}
        blockTitle={title}
      />

      {/* Remove button on hover */}
      {editable && (
        <form action={removeFromStack} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
          <input type="hidden" name="stackId" value={stackId} />
          <input type="hidden" name="postId" value={tile.id} />
          <button
            className="px-2 py-1 text-xs rounded bg-white/90 border"
            type="submit"
          >
            ⌫
          </button>
        </form>
      )}
    </div>
  );
}

/** PDF tile content with lightbox */
function PdfTileContent({
  tile,
  coverCandidate,
  title,
}: {
  tile: StackPostTile;
  coverCandidate: string;
  title: string;
}) {
  const [imgSrc, setImgSrc] = React.useState(coverCandidate);
  React.useEffect(() => setImgSrc(coverCandidate), [coverCandidate]);

  return (
    <PdfLightbox
      trigger={
        <img
          src={imgSrc}
          alt={title}
          className="w-full aspect-[4/3] object-cover cursor-pointer select-none"
          draggable={false}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (imgSrc !== "/assets/PDF.svg") setImgSrc("/assets/PDF.svg");
          }}
        />
      }
      postId={tile.id}
      title={title}
    />
  );
}

function CiteButton({ libraryPostId }: { libraryPostId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative ">
      <button className="px-2 py-1 text-xs rounded-lg bg-white/90 border" onClick={() => setOpen((x) => !x)}>Cite</button>
      {open && (
        <div className="relative z-20 mt-1 w-44 rounded border bg-slate-50 shadow-lg border-[2px] border-indigo-300">
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-200"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("composer:cite", { detail: { libraryPostId, mode: "quick" } }));
            }}
          >
            Quick cite
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-200"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("composer:cite", { detail: { libraryPostId, mode: "details" } }));
            }}
          >
            Cite with details…
          </button>
        </div>
      )}
    </div>
  );
}
