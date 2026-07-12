
 "use client";
 import React from "react";
 
 export default function ReceiptChip({ messageId, latest }: { messageId: string; latest: any }) {
   if (!latest) return null;
   const t = new Date(latest.merged_at || latest.mergedAt).toLocaleString();
   return (
     <div className="mt-1 text-[11px] text-slate-500">
       v{latest.v} • merged {t}{" "}
       <a
         className="underline"
         href={`/m/${encodeURIComponent(messageId)}/compare?v=${latest.v}`}
         target="_blank"
         rel="noreferrer"
       >
         view
       </a>
     </div>
   );
 }
