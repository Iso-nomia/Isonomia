// components/chat/LinkCard.tsx
"use client";
export function LinkCard({ p }: { p: { urlHash: string; url: string; title?: string|null; desc?: string|null; image?: string|null; status: string } }) {
  const host = (() => { try { return new URL(p.url).host; } catch { return ""; }})();
  if (p.status !== "ok") {
    return <a href={p.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border bg-white/70 px-3 py-2 text-sm hover:bg-white">{p.url}</a>;
  }
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className="block savebutton border-[1.5px] border-slate-400  rounded-xl  max-w-[60%] px-3 py-3 ">
      <div className="text-[12px]  flex flex-wrap flex-col w-fit text-slate-500">{host}</div>
      {p.title ? <div className="font-medium">{p.title}</div> : null}
      {p.desc ? <div className="text-sm text-slate-600    w-fit text-slate-500 mt-1 line-clamp-3">{p.desc}</div> : null}
      {p.image ? <div className="mt-2 overflow-hidden rounded-md"><img src={p.image} alt="" className="max-h-40 rounded-xl w-fit object-fill" /></div> : null}
    </a>
  );
}
