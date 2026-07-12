'use client';
import * as React from 'react';
import useSWR from 'swr';
const fetcher=(u:string)=>fetch(u).then(r=>r.json());

export function VoteWidget({ sessionId }: { sessionId: string }) {
  const [sel, setSel] = React.useState<Record<string, boolean>>({});
  const [rank, setRank] = React.useState<string[]>([]);

  const { data, mutate } = useSWR(`/api/votes/sessions?sessionId=${sessionId}`, fetcher);
  const session = (data?.items ?? []).find((s:any)=>s.id===sessionId);
  if (!session) return null;

  async function cast() {
    await fetch(`/api/votes/${sessionId}/vote`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify(session.method==='approval' ? { approvals: sel } : { ranking: rank }),
    });
    mutate();
  }

  if (session.closedAt) {
    const t = session.tallyJson ?? {};
    return <div className="text-[12px]">Closed · Winner: <b>{session.winnerId ?? '—'}</b><pre className="bg-slate-50 p-2 rounded mt-1">{JSON.stringify(t, null, 2)}</pre></div>;
  }

  const opts = session.optionsJson ?? [];
  return (
    <div className="text-[12px] border rounded p-2 bg-white">
      <div className="font-medium mb-1">Vote ({session.method})</div>
      {session.method === 'approval' ? (
        <div className="space-y-1">
          {opts.map((o:any)=>(
            <label key={o.id} className="flex items-center gap-2">
              <input type="checkbox" checked={!!sel[o.id]} onChange={e=>setSel(s=>({...s, [o.id]: e.target.checked}))}/>
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {opts.map((o:any)=>(
            <button key={o.id}
              className={`px-2 py-0.5 border rounded text-[11px] ${rank.includes(o.id)?'bg-amber-50 border-amber-300':'bg-white'}`}
              onClick={()=>setRank(r => r.includes(o.id) ? r.filter(x=>x!==o.id) : [...r, o.id])}
            >{rank.indexOf(o.id)+1 || '•'} {o.label}</button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button className="px-2 py-0.5 border rounded text-[11px]" onClick={cast}>Submit</button>
        <span className="text-neutral-500">closes {new Date(session.closesAt).toLocaleString()}</span>
      </div>
    </div>
  )
}
