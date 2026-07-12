"use client";
import React from "react";
import GalleryCarousel from "./GalleryCarousel";
import StackCarousel from "./StackCarousel";
import Link from "next/link";

export type LibraryCardProps = {
  kind: "single" | "stack";
  coverUrl?: string;              // single
  libraryPostId?: string;         // single
  stackId?: string;               // stack
  coverUrls?: string[];           // stack
  size?: number;                  // stack size
  caption?: string | null;
  onOpenPdf?: (libraryPostId: string) => void;
  onOpenStack?: (stackId: string) => void;
};

export default function LibraryCard(props: LibraryCardProps) {
  const { kind, coverUrl, coverUrls = [], size = 0, caption, libraryPostId, stackId, onOpenPdf, onOpenStack } = props;

  const Placeholder = ({
         label,
         sublabel,
         onClick,
       }: { label: string; sublabel?: string | null; onClick?: () => void }) => (
         <div
           className="w-full rounded-md border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer"
           onClick={onClick}
           role="button"
         >
           <div className="aspect-[4/3] flex items-center justify-center">
             <div className="text-center">
               <div className="text-4xl mb-2">📄</div>
               <div className="font-medium">{label}</div>
               {sublabel ? <div className="text-xs text-neutral-500 mt-1">{sublabel}</div> : null}
             </div>
           </div>
         </div>
       );
     
       if (kind === "single") {
         if (coverUrl) {
           return (
             <div>
               <img
                 src={coverUrl}
                 alt="PDF cover"
                 className="rounded-md cursor-pointer w-full h-auto"
                 onClick={() => libraryPostId && onOpenPdf?.(libraryPostId)}
               />
               {caption ? <div className="mt-2 text-sm text-neutral-600">{caption}</div> : null}
             </div>
           );
         }
         // Fallback while preview is generating / pipeline is stubbed
         return (
           <Placeholder
             label="PDF"
             sublabel={caption}
             onClick={() => libraryPostId && onOpenPdf?.(libraryPostId)}
           />
         );
       }

  if (kind === "stack") {
    if (size <= 10 && (coverUrls?.length ?? 0) > 0) {
      return (
        <div className="grid justify-center items-center w-full">
          <StackCarousel urls={coverUrls} caption={caption || undefined} />
        </div>
      );
    }
    // If we have no covers yet, show a stack placeholder
     if (!coverUrls || coverUrls.length === 0) {
         return (
           <Placeholder
             label={`Stack (${size})`}
             sublabel={caption}
             onClick={() => stackId && onOpenStack?.(stackId)}
           />
         );
       }
       // >10 with covers: simple 2x2 collage
       const tiles = coverUrls.slice(0, 4);
       return (
         <div className="w-full">
           <div className="grid grid-cols-2 gap-1 rounded-md overflow-hidden">
             {tiles.map((u, i) => (
               <img key={i} src={u} alt={`PDF ${i}`} className="w-full aspect-[4/3] object-cover" />
             ))}
           </div>
           {stackId ? (
             <Link href={`/stacks/${stackId}`} className="mt-2 inline-block text-sm underline">
               View Stack ({size})
             </Link>
           ) : (
             <button
               className="mt-2 text-sm underline"
               onClick={() => stackId && onOpenStack?.(stackId)}
             >
               View Stack ({size})
             </button>
           )}
         </div>
       );
  }
  return null;
}

