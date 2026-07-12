// "use client";
// import Image from "next/image";
// import PrivateChatPane from "../PrivateChatPane";
// import { usePrivateChatManager } from "@/contexts/PrivateChatManager";
// import { useAuth } from "@/lib/AuthContext";
// import { useEffect, useState } from "react";

// export default function PrivateChatDock({ currentUserId }: { currentUserId?: string }) {
//   const [mounted, setMounted] = useState(false);
//   useEffect(() => setMounted(true), []);
//   if (!mounted) return null; // avoid SSR/CSR mismatch
//   const { state, dispatch } = usePrivateChatManager();
//   const panes = Object.values(state.panes || []);
//   const openPanes = panes.filter(p => !p.minimised);
//   const minimised = panes.filter(p => p.minimised);

//   // get name/photo
//   const { user } = useAuth();
//   const meName = user?.name ?? user?.username ?? null;
//   const meImage = user?.image ?? null;

//   if (!panes.length) return null;

//   return (
//     <div id="pcp-bounds" className="fixed inset-0 pointer-events-none z-[9990]">
//       {/* floating panes */}
//       {openPanes.map(p => (
//         <PrivateChatPane
//           key={p.id}
//           pane={p}
//           currentUserId={currentUserId}
//           currentUserName={meName}
//           currentUserImage={meImage}
//         />
//       ))}

//       {/* dock bar */}
//       {minimised.length > 0 && (
//         <div className="pointer-events-auto fixed bottom-0 left-12 flex flex-row-reverse gap-2">
//           {minimised.map(p => (
//             <button
//               key={p.id}
//               title={`Open chat with ${p.peerName}`}
//               onClick={() => dispatch({ type: "RESTORE", id: p.id })}
//               className="group flex items-center gap-2 rounded-t-md rounded-bl-md bg-white/90 backdrop-blur border shadow px-3 py-2 hover:bg-white"
//             >
//               {p.peerImage ? (
//                 <Image src={p.peerImage} alt="" width={20} height={20} className="rounded-full object-cover" />
//               ) : (
//                 <span className="inline-block w-5 h-5 rounded-full bg-slate-300" />
//               )}
//               <span className="text-sm">{p.peerName}</span>
//               {p.unread ? <span className="ml-1 text-xs rounded bg-indigo-600 text-white px-1">{p.unread}</span> : null}
//               <span
//                 className="ml-2 text-slate-500 hover:text-slate-800"
//                 onClick={(e) => { e.stopPropagation(); dispatch({ type: "CLOSE", id: p.id }); }}
//               >
//                 ×
//               </span>
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }
// components/chat/PrivateChatDock.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import PrivateChatPane from "../PrivateChatPane";
import { usePrivateChatManager } from "@/contexts/PrivateChatManager";
import { useAuth } from "@/lib/AuthContext";

export default function PrivateChatDock({ currentUserId }: { currentUserId?: string }) {
  // Call hooks unconditionally, in a stable order
  const { state, dispatch } = usePrivateChatManager();
  const { user } = useAuth();

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Bail out of rendering until mounted (prevents hydration mismatch)
  if (!mounted) return null;

  const panes = Object.values(state.panes || []);
  const openPanes = panes.filter(p => !p.minimised);
  const minimised = panes.filter(p => p.minimised);
  if (!panes.length) return null;

  // useEffect(() => {
  //   console.log("[DOCK] open panes:", openPanes.map(p => ({id:p.id, unread:p.unread, min:p.minimised})));
  //   console.log("[DOCK] minimised tabs:", minimised.map(p => ({id:p.id, unread:p.unread})));
  // }, [state.panes, openPanes.length, minimised.length]);

  const meName = user?.displayName ?? user?.username ?? null;
  const meImage = user?.photoURL ?? null;

  return (
    <div id="pcp-bounds" className="fixed inset-0 pointer-events-none z-[9990]">
      {openPanes.map(p => (
        <PrivateChatPane
          key={p.id}
          pane={p}
          currentUserId={currentUserId}
          currentUserName={meName}
          currentUserImage={meImage}
        />
      ))}
      {minimised.length > 0 && (
        <div className="pointer-events-auto fixed bottom-0 left-12 flex flex-row-reverse gap-2">
          {minimised.map(p => (
            <button
              key={p.id}
              title={`Open chat with ${p.peerName}`}
              onClick={() => dispatch({ type: "RESTORE", id: p.id })}
              className="group flex items-center gap-2 rounded-t-md rounded-bl-md bg-white/90 backdrop-blur border shadow px-3 py-2 hover:bg-white"
            >
              {p.peerImage ? (
                <Image src={p.peerImage} alt="" width={20} height={20} className="rounded-full object-cover" />
              ) : (
                <span className="inline-block w-5 h-5 rounded-full bg-slate-300" />
              )}
              <span className="text-sm">{p.peerName}</span>
              {p.unread ? (
                <span className="ml-1 text-xs rounded bg-indigo-600 text-white px-1">{p.unread}</span>
              ) : null}
              <span
                className="ml-2 text-slate-500 hover:text-slate-800"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: "CLOSE", id: p.id }); }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
