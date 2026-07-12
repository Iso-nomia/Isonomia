 "use client";
 import { useRouter, useSearchParams } from "next/navigation";
 
 export default function StarredFilterToggle() {
   const router = useRouter();
   const sp = useSearchParams();
   const starred = sp?.get("starred") === "1";

   function toggle() {
     const params = new URLSearchParams(sp?.toString() ?? "");
     if (starred) params.delete("starred");
     else params.set("starred", "1");
     router.replace("?" + params.toString());
   }
 
   return (
     <button
       type="button"
       onClick={toggle}
       className={
         "text-xs px-2 py-1 rounded-lg border " +
         (starred
           ? "bg-yellow-200 border-yellow-300 text-yellow-900"
           : "bg-transparent border-gray-300 text-gray-600 hover:bg-gray-100")
       }
       title="Show only starred messages"
     >
       ★ Starred
     </button>
   );
 }
 