// app/(kb)/kb/pages/[id]/edit/ui/BlockList.tsx
'use client';
import * as React from 'react';

export function BlockList({ blocks, render, pageId }: {
  blocks: any[]; onReorder?: (ids: string[]) => void; render: (b: any) => React.ReactNode; pageId?: string
}) {
//   const [dragId, setDragId] = React.useState<string|null>(null);

//   function onDragStart(id:string) { setDragId(id); }
//   function onDragOver(e:React.DragEvent, overId:string) {
//     e.preventDefault();
//     if (!dragId || dragId===overId) return;
//     const ids = blocks.map(b=>b.id);
//     const from = ids.indexOf(dragId);
//     const to   = ids.indexOf(overId);
//     if (from<0 || to<0 || from===to) return;
//     const next = ids.slice();
//     next.splice(to, 0, next.splice(from,1)[0]);
//     onReorder(next);
//   }



  const [dragId, setDragId] = React.useState<string|null>(null);
const [order, setOrder] = React.useState<string[]>([]);
React.useEffect(()=>{ setOrder(blocks.map(b=>b.id)); }, [blocks.map(b=>b.id).join(',')]);

function onDragStart(id:string){ setDragId(id); }
function onDragOver(id:string, e:React.DragEvent){ e.preventDefault(); if (!dragId || dragId===id) return;
  const cur = [...order]; const from = cur.indexOf(dragId); const to = cur.indexOf(id);
  if (from<0 || to<0 || from===to) return;
  cur.splice(to, 0, cur.splice(from,1)[0]); // move
  setOrder(cur);
}
async function onDrop() {
  if (!dragId) return; setDragId(null);
  await fetch(`/api/kb/pages/${pageId}/reorder`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ order })
  });
  // refetchBlocks(); // TODO: pass refetch callback as prop
}


  return (
    <ul className="space-y-3">
      {blocks.map(b => (
        <li key={b.id} draggable
            onDragStart={()=>onDragStart(b.id)}
            onDragOver={(e)=>onDragOver(b.id,e)}
            className="border rounded bg-white/80">
          <div className="flex items-center justify-between px-2 py-1 border-b">
            <span className="text-[11px] text-slate-500">⋮⋮ drag</span>
          </div>
          {render(b)}
        </li>
      ))}
    </ul>
  );
}