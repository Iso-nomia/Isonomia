 "use client";
 import { useStars } from "@/hooks/useStars";
 
 type IdLike = string | number | bigint;
 const toStr = (v: IdLike) => (typeof v === "bigint" ? v.toString() : String(v));
 
 export default function StarToggle({
   conversationId,
   messageId,
   className = "",
 }: {
   conversationId: IdLike;
   messageId: IdLike;
   className?: string;
 }) {
   const { isStarred, toggleStar } = useStars(conversationId);
   const starred = isStarred(messageId);
 
   return (
     <button
       type="button"
       onClick={(e) => {
         e.preventDefault();
         e.stopPropagation();
         toggleStar(messageId);
       }}
       aria-pressed={starred}
       title={starred ? "Unstar" : "Star"}
       className={
         "opacity-0 group-hover:opacity-100 transition-opacity text-yellow-500/80 hover:text-yellow-500 focus:opacity-100 "  +
         (className ?? "")
       }
     >
       <span className="text-lg leading-none">{starred ? "★" : "☆"}</span>
     </button>
   );
 }
 