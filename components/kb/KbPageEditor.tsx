"use client";
import * as React from "react";
import useSWR from "swr";
import { KbBlockRenderer } from "./KbBlockRenderer";
import { SnapshotListModal } from "./SnapshotListModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

function SortableBlock({
  block,
  canEdit,
  onToggleLive,
  onDelete,
  onUpdate,
}: {
  block: any;
  canEdit: boolean;
  onToggleLive: (id: string, live: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="rounded border bg-white/70 p-2"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 px-1"
              title="Drag to reorder"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm7-10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
          <div className="text-[11px] uppercase tracking-wide text-slate-600">
            {block.type}
            {!block.live && (
              <span className="ml-2 px-1.5 py-[1px] rounded bg-amber-50 border border-amber-200 text-amber-700">
                pinned
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] flex items-center gap-2">
          <button
            className="underline"
            onClick={() => onToggleLive(block.id, !block.live)}
          >
            {block.live ? "Pin (freeze)" : "Unpin (live)"}
          </button>
          <button className="underline" onClick={() => onDelete(block.id)}>
            Delete
          </button>
        </div>
      </div>
      <KbBlockRenderer
        block={block}
        hydrated={true}
        canEdit={canEdit}
        onUpdate={onUpdate}
      />
    </section>
  );
}

export default function KbPageEditor({ pageId }: { pageId: string }) {
  const { data, error, mutate } = useSWR(`/api/kb/pages/${pageId}`, fetcher);
  const [blocks, setBlocks] = React.useState<any[]>([]);
  const [reordering, setReordering] = React.useState(false);
  const [showSnapshots, setShowSnapshots] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync blocks from API data
  React.useEffect(() => {
    if (data?.page?.blocks) {
      setBlocks(data.page.blocks);
    }
  }, [data]);

  async function addBlock(type: string) {
    await fetch(`/api/kb/pages/${pageId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data: defaultDataFor(type) }),
    });
    mutate();
  }

  async function toggleLive(id: string, live: boolean) {
    await fetch(`/api/kb/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ live }),
    });
    mutate();
  }

  async function deleteBlock(id: string) {
    await fetch(`/api/kb/blocks/${id}`, { method: "DELETE" });
    mutate();
  }

  async function snapshot() {
    await fetch(`/api/kb/pages/${pageId}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    mutate();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      const newBlocks = arrayMove(blocks, oldIndex, newIndex);
      setBlocks(newBlocks);

      // Save new order to API
      setReordering(true);
      try {
        const res = await fetch(`/api/kb/pages/${pageId}/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: newBlocks.map((b) => b.id) }),
        });
        if (res.ok) {
          mutate();
        }
      } catch (e) {
        console.error("Failed to reorder:", e);
        mutate(); // Revert on error
      } finally {
        setReordering(false);
      }
    }
  }

  if (error)
    return <div className="text-xs text-red-600">Failed to load page</div>;
  if (!data?.page)
    return <div className="text-xs text-neutral-500">Loading…</div>;

  const p = data.page as any;
  const canEdit = p.canEdit !== false;

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{p.title}</h1>
          <div className="text-[11px] text-slate-600">
            /kb/{p.spaceId}/{p.slug}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-[12px] rounded border px-2 py-1"
            onChange={(e) => addBlock(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              + block
            </option>
            <option value="text">text</option>
            <option value="image">image</option>
            <option value="link">link</option>
            <option value="claim">claim</option>
            <option value="argument">argument</option>
            <option value="sheet">sheet</option>
            <option value="room_summary">room summary</option>
            <option value="transport">transport</option>
          </select>
          <button
            className="rounded border px-2 py-1 text-[12px] hover:bg-slate-50"
            onClick={snapshot}
          >
            snapshot
          </button>
          <button
            className="rounded border px-2 py-1 text-[12px] hover:bg-slate-50"
            onClick={() => setShowSnapshots(true)}
          >
            history
          </button>
          {reordering && (
            <span className="text-[11px] text-amber-600">Saving order...</span>
          )}
        </div>
      </header>

      <SnapshotListModal
        pageId={pageId}
        isOpen={showSnapshots}
        onClose={() => setShowSnapshots(false)}
        onRestore={mutate}
      />

      <main className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((b: any) => (
              <SortableBlock
                key={b.id}
                block={b}
                canEdit={canEdit}
                onToggleLive={toggleLive}
                onDelete={deleteBlock}
                onUpdate={mutate}
              />
            ))}
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}

function defaultDataFor(type:string){
  if (type==='text') return { markdown: 'Write here…' };
  if (type==='image') return { url:'', alt:'', caption:'' };
  if (type==='link')  return { url:'https://', title:'' };
  if (type==='claim') return { claimId:'', label:'Claim' };
  if (type==='argument') return { argumentId:'' };
  if (type==='room_summary') return { deliberationId:'', eval:{ mode:'product' }, lens:'top' };
  if (type==='sheet') return { sheetId:'', lens:'mini' };
  if (type==='transport') return { fromId:'', toId:'', showProposals:true };
  return {};
}
