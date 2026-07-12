// components/ThreadsClient.tsx
'use client'; // This directive is crucial

// export const dynamic = "force-dynamic";
// import useSWR from "swr";

// function Client() {
//   const { data } = useSWR("/api/agora/threads", (u)=>fetch(u).then(r=>r.json()));
//   const items = data?.items ?? [];
//   return (
//     <div className="max-w-5xl mx-auto p-4 space-y-2">
//       <h1 className="text-lg font-semibold mb-2">Response Threads</h1>
//       {items.map((x:any)=>(
//         <div key={x.id} className="rounded border bg-white/70 p-3 text-[13px] flex items-center justify-between">
//           <div className="truncate">
//             <b>{x.relation}</b> · from {x.fromType}:{String(x.fromId).slice(0,6)}… → {x.toType}:{String(x.toId).slice(0,6)}…
//           </div>
//           {x.toType==='deliberation' && <a className="underline" href={`/deliberation/${x.toId}`}>Open</a>}
//         </div>
//       ))}
//       {!items.length && <div className="text-sm text-slate-600">No threads yet.</div>}
//     </div>
//   );
// }

// import dynamic from "next/dynamic";
// const Threads = dynamic(() => Promise.resolve(Client), { ssr: false });
// export default function Page(){ return <Threads />; }

import useSWR from "swr";

function ThreadsClient() {
  const { data } = useSWR("/api/agora/threads", (u) => fetch(u).then(r => r.json()));
  const items = data?.items ?? [];
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-2">
      <h1 className="text-lg font-semibold mb-2">Response Threads</h1>
      {items.map((x:any) => (
        <div key={x.id} className="rounded border bg-white/70 p-3 text-[13px] flex items-center justify-between">
          <div className="truncate">
            <b>{x.relation}</b> · from {x.fromType}:{String(x.fromId).slice(0,6)}… → {x.toType}:{String(x.toId).slice(0,6)}…
          </div>
          {x.toType==='deliberation' && <a className="underline" href={`/deliberation/${x.toId}`}>Open</a>}
        </div>
      ))}
      {!items.length && <div className="text-sm text-slate-600">No threads yet.</div>}
    </div>
  );
}

export default ThreadsClient;